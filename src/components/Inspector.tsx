import {
  Accordion,
  ActionIcon,
  Box,
  Button,
  Group,
  Modal,
  NumberInput,
  Stack,
  Switch,
  Tabs,
  Text,
} from "@mantine/core";
import { MdDelete, MdDragIndicator } from "react-icons/md";
import { useRef, useState } from "react";

import { deleteKeyPlugin, updateKeyPlugin } from "../api/workspaces";
import { pluginById, plugins } from "../plugins/registry";
import { downState, upConfig } from "../plugins/state";
import type { KeyPlugin, WorkspaceData } from "../types/workspace";

type Props = {
  workspace: WorkspaceData | null;
  selectedKey: string | null;
  tab: string | null;
  onTabChange: (tab: string | null) => void;
  onChange: (plugins: KeyPlugin[]) => void;
  onPreviewDownPluginChange: (pluginId: number | null) => void;
};

function pluginSummary(item: KeyPlugin) {
  if (item.plugin_id === "kbrd.label") {
    const text = item.config.text;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  }
  if (item.plugin_id === "kbrd.image") {
    const name = item.config.name ?? item.config.media;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  }
  return null;
}

function setDragSymbol(event: React.DragEvent, symbol = "⠿") {
  const dragImage = document.createElement("div");
  dragImage.textContent = symbol;
  Object.assign(dragImage.style, {
    position: "fixed",
    top: "-100px",
    left: "-100px",
    padding: "4px 8px",
    border: "1px solid white",
    borderRadius: "4px",
    background: "#222120",
    color: "white",
    fontSize: "20px",
    lineHeight: "1",
  });
  document.body.appendChild(dragImage);
  event.dataTransfer.setDragImage(dragImage, 12, 12);
  requestAnimationFrame(() => dragImage.remove());
}

export default function Inspector({
  workspace,
  selectedKey,
  tab,
  onTabChange,
  onChange,
  onPreviewDownPluginChange,
}: Props) {
  const [propertyStates, setPropertyStates] = useState<
    Record<number, "main" | "up" | "down">
  >({});
  const [deleting, setDeleting] = useState<KeyPlugin | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    id: number;
    edge: "before" | "after";
  } | null>(null);
  const pendingSaves = useRef(
    new Map<
      number,
      { data: Partial<KeyPlugin>; timer: ReturnType<typeof setTimeout> }
    >(),
  );
  const allInstances = workspace?.plugins ?? [];
  const instances = allInstances
    .filter((plugin) => plugin.key_ref === selectedKey)
    .sort((left, right) => left.position - right.position);

  function patch(item: KeyPlugin, data: Partial<KeyPlugin>) {
    const value = { ...item, ...data };
    onChange(
      allInstances.map((plugin) => (plugin.id === value.id ? value : plugin)),
    );

    const pending = pendingSaves.current.get(item.id);
    if (pending) clearTimeout(pending.timer);
    const merged = { ...pending?.data, ...data };
    const timer = setTimeout(() => {
      pendingSaves.current.delete(item.id);
      void updateKeyPlugin(item.id, merged);
    }, 200);
    pendingSaves.current.set(item.id, { data: merged, timer });
  }

  async function reorder(
    draggedId: number,
    targetId: number,
    edge: "before" | "after",
  ) {
    const from = instances.findIndex((item) => item.id === draggedId);
    if (from === -1 || draggedId === targetId) return;

    const positions = instances.map((item) => item.position);
    const reordered = [...instances];
    const [dragged] = reordered.splice(from, 1);
    const targetIndex = reordered.findIndex((item) => item.id === targetId);
    if (targetIndex === -1) return;
    reordered.splice(targetIndex + (edge === "after" ? 1 : 0), 0, dragged);
    if (reordered.every((item, index) => item.id === instances[index].id)) return;
    const positioned = reordered.map((item, index) => ({
      ...item,
      position: positions[index],
    }));

    const reorderedById = new Map(positioned.map((item) => [item.id, item]));
    onChange(allInstances.map((item) => reorderedById.get(item.id) ?? item));
    await Promise.all(
      positioned
        .filter(
          (item) =>
            instances.find((instance) => instance.id === item.id)?.position !==
            item.position,
        )
        .map((item) => updateKeyPlugin(item.id, { position: item.position })),
    );
  }

  async function remove(item: KeyPlugin) {
    const pending = pendingSaves.current.get(item.id);
    if (pending) clearTimeout(pending.timer);
    pendingSaves.current.delete(item.id);
    onChange(allInstances.filter((plugin) => plugin.id !== item.id));
    if (pending) await updateKeyPlugin(item.id, pending.data);
    await deleteKeyPlugin(item.id);
    onPreviewDownPluginChange(null);
    setDeleting(null);
  }

  return (
    <Box
      h="100%"
      bg="var(--kbrd-color-body)"
      p="lg"
      style={{ overflow: "auto" }}
    >
      <Tabs
        className="inspector-tabs"
        value={tab}
        onChange={onTabChange}
        variant="outline"
      >
        <Tabs.List grow>
          <Tabs.Tab value="plugins">Plugins</Tabs.Tab>
          <Tabs.Tab value="properties">Properties</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="plugins" pt="lg" pb="lg">
          {!workspace ? (
            <Text c="dimmed">Create a workspace to add plugins.</Text>
          ) : (
            <Accordion multiple defaultValue={["Display"]}>
              {[...new Set(plugins.map((plugin) => plugin.category))].map(
                (category) => {
                  const categoryPlugins = plugins.filter(
                    (plugin) => plugin.category === category,
                  );
                  return (
                    <Accordion.Item key={category} value={category}>
                      <Box className="inspector-accordion-heading">
                        <Accordion.Control>{category}</Accordion.Control>
                      </Box>
                      <Accordion.Panel className="plugin-category-panel">
                        {categoryPlugins.map((plugin, index) => (
                          <Box
                            key={plugin.id}
                            py="sm"
                            draggable
                            style={{
                              borderBottom:
                                categoryPlugins.length > 1 &&
                                index < categoryPlugins.length - 1
                                  ? "1px solid var(--kbrd-border-color)"
                                  : undefined,
                            }}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "copy";
                              event.dataTransfer.setData(
                                "application/kbrd-plugin",
                                plugin.id,
                              );
                              setDragSymbol(event);
                            }}
                          >
                            <Group justify="space-between" wrap="nowrap">
                              <Group gap="xs" wrap="nowrap">
                                <MdDragIndicator
                                  aria-label="Move plugin"
                                  style={{ cursor: "grab", flexShrink: 0 }}
                                />
                                <Text>{plugin.name}</Text>
                              </Group>
                              <Text size="xs" c="dimmed">
                                {plugin.version}
                              </Text>
                            </Group>
                          </Box>
                        ))}
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                },
              )}
            </Accordion>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="properties" p="md">
          {!selectedKey ? (
            <Text c="dimmed">No key selected</Text>
          ) : instances.length === 0 ? (
            <Text c="dimmed">No plugin on this key</Text>
          ) : (
            <Accordion multiple className="property-accordion">
              {instances.map((item) => {
                const plugin = pluginById(item.plugin_id);
                if (!plugin) return null;
                const Editor = plugin.Editor;
                const summary = pluginSummary(item);
                const propertyState = propertyStates[item.id] ?? "main";
                const down = downState(item.config);
                const up = upConfig(item.config);
                function patchDown(data: Partial<typeof down>) {
                  patch(item, {
                    config: {
                      ...up,
                      down: { ...down, ...data },
                    },
                  });
                }
                return (
                  <Accordion.Item
                    key={item.id}
                    value={String(item.id)}
                    style={{
                      position: "relative",
                    }}
                    onDragOver={(event) => {
                      if (
                        event.dataTransfer.types.includes(
                          "application/kbrd-property",
                        )
                      ) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        const bounds = event.currentTarget.getBoundingClientRect();
                        setDropIndicator({
                          id: item.id,
                          edge:
                            event.clientY < bounds.top + bounds.height / 2
                              ? "before"
                              : "after",
                        });
                      }
                    }}
                    onDragLeave={(event) => {
                      if (
                        !event.currentTarget.contains(
                          event.relatedTarget as Node | null,
                        )
                      ) {
                        setDropIndicator((value) =>
                          value?.id === item.id ? null : value,
                        );
                      }
                    }}
                    onDrop={(event) => {
                      const draggedId = Number(
                        event.dataTransfer.getData("application/kbrd-property"),
                      );
                      if (!Number.isNaN(draggedId)) {
                        event.preventDefault();
                        const edge =
                          dropIndicator?.id === item.id
                            ? dropIndicator.edge
                            : "before";
                        setDropIndicator(null);
                        void reorder(draggedId, item.id, edge);
                      }
                    }}
                  >
                    {dropIndicator?.id === item.id && (
                      <Box
                        aria-hidden
                        style={{
                          position: "absolute",
                          zIndex: 10,
                          left: 0,
                          right: 0,
                          [dropIndicator.edge === "before" ? "top" : "bottom"]:
                            -1,
                          height: 2,
                          pointerEvents: "none",
                          backgroundColor: "var(--kbrd-border-color)",
                        }}
                      />
                    )}
                    <Group
                      className="inspector-accordion-heading"
                      gap={0}
                      wrap="nowrap"
                    >
                      <Box
                        draggable
                        px="xs"
                        py="sm"
                        onDragStart={(event) => {
                          event.stopPropagation();
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "application/kbrd-property",
                            String(item.id),
                          );
                          setDragSymbol(event);
                        }}
                        onDragEnd={() => setDropIndicator(null)}
                      >
                        <MdDragIndicator
                          aria-label={`Move ${plugin.name}`}
                          style={{ cursor: "grab", display: "block" }}
                        />
                      </Box>
                      <Accordion.Control style={{ flex: 1 }}>
                        <Text fw={600} truncate>
                          {plugin.name}
                          {summary && ` (${summary})`}
                        </Text>
                      </Accordion.Control>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        aria-label={`Delete ${plugin.name}`}
                        mr="xs"
                        onClick={() => setDeleting(item)}
                      >
                        <MdDelete />
                      </ActionIcon>
                    </Group>
                    <Accordion.Panel className="property-editor-panel">
                      <Tabs
                        className="state-tabs"
                        value={propertyState}
                        onChange={(value) => {
                          setPropertyStates((states) => ({
                            ...states,
                            [item.id]: (value ?? "main") as
                              | "main"
                              | "up"
                              | "down",
                          }));
                          onPreviewDownPluginChange(
                            value === "down" ? item.id : null,
                          );
                        }}
                      >
                        <Tabs.List grow>
                          <Tabs.Tab value="main">Main</Tabs.Tab>
                          <Tabs.Tab value="up" disabled={!item.enabled}>
                            Up
                          </Tabs.Tab>
                          {down.enabled && (
                            <Tabs.Tab value="down" disabled={!item.enabled}>
                              Down
                            </Tabs.Tab>
                          )}
                        </Tabs.List>

                        <Tabs.Panel value="main" pt="xl">
                          <Stack gap="lg">
                            <Switch
                              label="Disabled"
                              checked={!item.enabled}
                              onChange={(event) => {
                                const disabled = event.currentTarget.checked;
                                if (disabled) {
                                  setPropertyStates((states) => ({
                                    ...states,
                                    [item.id]: "main",
                                  }));
                                  onPreviewDownPluginChange(null);
                                }
                                void patch(item, { enabled: !disabled });
                              }}
                            />
                            <Switch
                              label="Down state"
                              checked={down.enabled}
                              onChange={(event) => {
                                const enabled = event.currentTarget.checked;
                                if (!enabled) {
                                  setPropertyStates((states) => ({
                                    ...states,
                                    [item.id]: "main",
                                  }));
                                  onPreviewDownPluginChange(null);
                                }
                                patchDown({
                                  enabled,
                                  config:
                                    down.config ?? structuredClone(up),
                                });
                              }}
                            />
                          </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="up" pt="xl">
                          <Editor
                            config={up}
                            onChange={(config) =>
                              patch(item, {
                                config: { ...config, down },
                              })
                            }
                          />
                        </Tabs.Panel>

                        {down.enabled && (
                          <Tabs.Panel value="down" pt="xl">
                            <Stack gap="xl">
                              <Editor
                                config={down.config ?? up}
                                onChange={(config) => patchDown({ config })}
                              />
                              <Box
                                pt="xs"
                                style={{ borderTop: "2px solid white" }}
                              >
                                <NumberInput
                                  label="Delay"
                                  suffix=" ms"
                                  min={0}
                                  allowNegative={false}
                                  value={down.delay}
                                  onChange={(value) =>
                                    patchDown({
                                      delay:
                                        typeof value === "number" ? value : 0,
                                    })
                                  }
                                />
                              </Box>
                            </Stack>
                          </Tabs.Panel>
                        )}
                      </Tabs>
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          )}
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={deleting !== null}
        onClose={() => setDeleting(null)}
        title={<Text fw={700}>Delete plugin</Text>}
        centered
        size="sm"
      >
        <Stack>
          <Text>
            Permanently delete{" "}
            <Text component="span" fw={600}>
              {deleting ? pluginById(deleting.plugin_id)?.name : "this plugin"}
            </Text>
            ?
          </Text>
          <Group justify="flex-end">
            <Button color="gray" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<MdDelete size={16} />}
              onClick={() => deleting && void remove(deleting)}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
