import {
  Accordion,
  ActionIcon,
  Box,
  Group,
  Menu,
  Tabs,
  Text,
} from "@mantine/core";
import { MdDelete, MdDragIndicator, MdMoreVert } from "react-icons/md";
import { useRef } from "react";

import { deleteKeyPlugin, updateKeyPlugin } from "../api/workspaces";
import { pluginById, plugins } from "../plugins/registry";
import type { KeyPlugin, WorkspaceData } from "../types/workspace";

type Props = {
  workspace: WorkspaceData | null;
  selectedKey: string | null;
  tab: string | null;
  onTabChange: (tab: string | null) => void;
  onChange: (plugins: KeyPlugin[]) => void;
};

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
}: Props) {
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

  async function reorder(draggedId: number, targetId: number) {
    const from = instances.findIndex((item) => item.id === draggedId);
    const to = instances.findIndex((item) => item.id === targetId);
    if (from === -1 || to === -1 || from === to) return;

    const positions = instances.map((item) => item.position);
    const reordered = [...instances];
    const [dragged] = reordered.splice(from, 1);
    reordered.splice(to, 0, dragged);
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
    await deleteKeyPlugin(item.id);
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
            <Text c="dimmed">Créez un workspace pour ajouter des plugins.</Text>
          ) : (
            <Accordion multiple defaultValue={["Display"]}>
              {[...new Set(plugins.map((plugin) => plugin.category))].map(
                (category) => {
                  const categoryPlugins = plugins.filter(
                    (plugin) => plugin.category === category,
                  );
                  return (
                    <Accordion.Item key={category} value={category}>
                      <Accordion.Control>{category}</Accordion.Control>
                      <Accordion.Panel>
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
                                  aria-label="Déplacer le plugin"
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
            <Text c="dimmed">Aucune touche sélectionnée</Text>
          ) : instances.length === 0 ? (
            <Text c="dimmed">Aucun plugin sur cette touche</Text>
          ) : (
            <Accordion multiple>
              {instances.map((item) => {
                const plugin = pluginById(item.plugin_id);
                if (!plugin) return null;
                const Editor = plugin.Editor;
                return (
                  <Accordion.Item
                    key={item.id}
                    value={String(item.id)}
                    onDragOver={(event) => {
                      if (
                        event.dataTransfer.types.includes(
                          "application/kbrd-property",
                        )
                      ) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDrop={(event) => {
                      const draggedId = Number(
                        event.dataTransfer.getData("application/kbrd-property"),
                      );
                      if (!Number.isNaN(draggedId)) {
                        event.preventDefault();
                        void reorder(draggedId, item.id);
                      }
                    }}
                  >
                    <Group gap={0} wrap="nowrap">
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
                      >
                        <MdDragIndicator
                          aria-label={`Déplacer ${plugin.name}`}
                          style={{ cursor: "grab", display: "block" }}
                        />
                      </Box>
                      <Accordion.Control style={{ flex: 1 }}>
                        <Text fw={600}>{plugin.name}</Text>
                      </Accordion.Control>
                      <Menu position="bottom-end">
                        <Menu.Target>
                          <ActionIcon
                            variant="subtle"
                            aria-label="Actions du plugin"
                            mr="xs"
                          >
                            <MdMoreVert />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Label>Actions</Menu.Label>
                          <Menu.Item
                            onClick={() =>
                              void patch(item, { enabled: !item.enabled })
                            }
                          >
                            {item.enabled ? "Désactiver" : "Activer"}
                          </Menu.Item>
                          <Menu.Item
                            color="red"
                            leftSection={<MdDelete />}
                            onClick={() => void remove(item)}
                          >
                            Supprimer
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                    <Accordion.Panel>
                      <Editor
                        disabled={!item.enabled}
                        config={item.config}
                        onChange={(config) => void patch(item, { config })}
                      />
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          )}
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
