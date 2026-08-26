import {
  Accordion,
  ActionIcon,
  Box,
  Button,
  ColorInput,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
} from "@mantine/core";
import { MdDelete, MdDragIndicator } from "react-icons/md";
import { useRef, useState } from "react";

import {
  deleteKeyPlugin,
  updateKeyPlugin,
  updateKeyProperties,
} from "../api/workspaces";
import { pluginById, plugins } from "../plugins/registry";
import { downState, upConfig } from "../plugins/state";
import type { GeometryLayout } from "../types/geometry";
import type {
  KeyPlugin,
  KeyProperty,
  KeyPropertyConfig,
  WorkspaceData,
} from "../types/workspace";

const BACKGROUND_REF = "__background__";
const DEFAULT_KEY_PROPERTIES: KeyPropertyConfig = {
  keyMode: "momentary",
  downEnabled: false,
  upBorderEnabled: true,
  downBorderEnabled: true,
  upBorderColor: "#808080",
  downBorderColor: "#ffffff",
  upBorderWidth: 1,
  downBorderWidth: 1,
  upBackgroundColor: "#00000000",
  downBackgroundColor: "#00000000",
};

type Props = {
  workspace: WorkspaceData | null;
  selectedKey: string | null;
  tab: string | null;
  onTabChange: (tab: string | null) => void;
  onChange: (plugins: KeyPlugin[]) => void;
  layout: GeometryLayout | null;
  onKeyPropertiesChange: (properties: KeyProperty[]) => void;
  onPreviewDownPluginChange: (pluginId: number | null) => void;
  onPreviewDownTargetChange: (keyRef: string | null) => void;
};

function pluginSummary(item: KeyPlugin) {
  if (item.plugin_id === "kbrd.render-label") {
    const text = item.config.text;
    return typeof text === "string" && text.trim()
      ? truncate(text.trim())
      : null;
  }
  if (item.plugin_id === "kbrd.render-image") {
    const name = item.config.name ?? item.config.media;
    return typeof name === "string" && name.trim()
      ? truncate(name.trim())
      : null;
  }
  return null;
}

function truncate(value: string) {
  return value.length > 15 ? `${value.slice(0, 15)}…` : value;
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
  layout,
  onKeyPropertiesChange,
  onPreviewDownPluginChange,
  onPreviewDownTargetChange,
}: Props) {
  const [propertyStates, setPropertyStates] = useState<
    Record<number, "main" | "up" | "down">
  >({});
  const [deleting, setDeleting] = useState<KeyPlugin | null>(null);
  const [targetStates, setTargetStates] = useState<
    Record<string, "option" | "up" | "down">
  >({});
  const [dropIndicator, setDropIndicator] = useState<{
    id: number;
    edge: "before" | "after";
  } | null>(null);
  const [draggedPropertyId, setDraggedPropertyId] = useState<number | null>(
    null,
  );
  const pendingSaves = useRef(
    new Map<
      number,
      { data: Partial<KeyPlugin>; timer: ReturnType<typeof setTimeout> }
    >(),
  );
  const pendingPropertySaves = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const allInstances = workspace?.plugins ?? [];
  const instances = allInstances
    .filter((plugin) => plugin.key_ref === selectedKey)
    .sort((left, right) => left.position - right.position);
  const propertyGroups = [...new Set(plugins.map((plugin) => plugin.category))]
    .map((category) => ({
      category,
      items: instances.filter(
        (item) => pluginById(item.plugin_id)?.category === category,
      ),
    }))
    .filter((group) => group.items.length > 0);
  const keyProperties = workspace?.key_properties ?? [];
  const selectedProperty = keyProperties.find(
    (property) => property.key_ref === selectedKey,
  );
  const legacyBorderWidth = (
    selectedProperty?.config as (KeyPropertyConfig & { borderWidth?: number })
      | undefined
  )?.borderWidth;
  const legacyBorderEnabled = selectedProperty?.config.borderEnabled ?? true;
  const propertyConfig: KeyPropertyConfig = {
    ...DEFAULT_KEY_PROPERTIES,
    ...selectedProperty?.config,
    upBorderWidth:
      selectedProperty?.config.upBorderWidth ?? legacyBorderWidth ?? 1,
    downBorderWidth:
      selectedProperty?.config.downBorderWidth ?? legacyBorderWidth ?? 1,
    upBorderEnabled:
      selectedProperty?.config.upBorderEnabled ?? legacyBorderEnabled,
    downBorderEnabled:
      selectedProperty?.config.downBorderEnabled ?? legacyBorderEnabled,
  };
  const targetType =
    selectedKey === BACKGROUND_REF
      ? "background"
      : (layout?.keys.find((key) => key.ref === selectedKey)?.type ?? "key");
  const storedTargetState = selectedKey
    ? (targetStates[selectedKey] ?? "option")
    : "option";
  const targetState =
    targetType !== "key" && storedTargetState === "down"
      ? "up"
      : storedTargetState;
  const systemPluginName =
    targetType === "background"
      ? "Workspace"
      : targetType === "space"
        ? "Space"
        : "Key";

  function patchKeyProperty(data: Partial<KeyPropertyConfig>) {
    if (!workspace || !selectedKey) return;
    const config = { ...propertyConfig, ...data };
    const property = { key_ref: selectedKey, config };
    onKeyPropertiesChange([
      ...keyProperties.filter((item) => item.key_ref !== selectedKey),
      property,
    ]);
    const pending = pendingPropertySaves.current.get(selectedKey);
    if (pending) clearTimeout(pending);
    pendingPropertySaves.current.set(
      selectedKey,
      setTimeout(() => {
        pendingPropertySaves.current.delete(selectedKey);
        void updateKeyProperties(workspace.id, selectedKey, config);
      }, 200),
    );
  }

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
    const draggedItem = instances.find((item) => item.id === draggedId);
    const targetItem = instances.find((item) => item.id === targetId);
    if (!draggedItem || !targetItem || draggedId === targetId) return;
    const category = pluginById(draggedItem.plugin_id)?.category;
    if (!category || pluginById(targetItem.plugin_id)?.category !== category) {
      return;
    }

    const categoryInstances = instances.filter(
      (item) => pluginById(item.plugin_id)?.category === category,
    );
    const from = categoryInstances.findIndex((item) => item.id === draggedId);

    const positions = categoryInstances.map((item) => item.position);
    const reordered = [...categoryInstances];
    const [dragged] = reordered.splice(from, 1);
    const targetIndex = reordered.findIndex((item) => item.id === targetId);
    if (targetIndex === -1) return;
    reordered.splice(targetIndex + (edge === "after" ? 1 : 0), 0, dragged);
    if (
      reordered.every(
        (item, index) => item.id === categoryInstances[index].id,
      )
    ) {
      return;
    }
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
            categoryInstances.find((instance) => instance.id === item.id)
              ?.position !== item.position,
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
            <Accordion multiple>
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

        <Tabs.Panel value="properties" pt="lg" pb="lg">
          {!selectedKey ? (
            <Text c="dimmed">No key selected</Text>
          ) : (
            <Stack gap={0}>
              <Box key={`${selectedKey}-system`} style={{ order: 2 }}>
                {!propertyGroups.some(
                  (group) => group.category === "Render",
                ) && (
                  <Text size="xs" fw={600} c="dimmed" mb="xs" tt="uppercase">
                    Render
                  </Text>
                )}
                <Accordion multiple className="property-accordion">
                <Accordion.Item value="system">
                  <Group
                    className="inspector-accordion-heading"
                    gap={0}
                    wrap="nowrap"
                  >
                    <Box
                      px={4}
                      py="sm"
                      aria-label={`Move ${systemPluginName} disabled`}
                      aria-disabled="true"
                    >
                      <MdDragIndicator
                        style={{
                          cursor: "not-allowed",
                          display: "block",
                          opacity: 0.35,
                        }}
                      />
                    </Box>
                    <Accordion.Control style={{ flex: 1, paddingLeft: 0 }}>
                      {systemPluginName}
                    </Accordion.Control>
                    <ActionIcon
                      color="red"
                      variant="transparent"
                      mr="xs"
                      aria-label={`Delete ${systemPluginName} disabled`}
                      disabled
                      style={{ backgroundColor: "transparent" }}
                    >
                      <MdDelete />
                    </ActionIcon>
                  </Group>
                  {targetType === "key" && (
                    <Accordion.Panel className="property-editor-panel">
                      <Tabs
                        className="state-tabs"
                        value={targetState}
                        onChange={(value) => {
                          const state = (value ?? "option") as
                            | "option"
                            | "up"
                            | "down";
                          setTargetStates((states) => ({
                            ...states,
                            [selectedKey]: state,
                          }));
                          onPreviewDownTargetChange(
                            state === "down" ? selectedKey : null,
                          );
                        }}
                      >
                        <Tabs.List grow>
                          <Tabs.Tab value="option">Option</Tabs.Tab>
                          <Tabs.Tab value="up">Up</Tabs.Tab>
                          {targetType === "key" && propertyConfig.downEnabled && (
                            <Tabs.Tab value="down">Down</Tabs.Tab>
                          )}
                        </Tabs.List>
                        <Tabs.Panel value="option" pt="xl">
                          <Stack gap="md">
                            <Group justify="space-between" wrap="nowrap">
                              <Text size="sm">Type</Text>
                              <Select
                                w={160}
                                size="xs"
                                allowDeselect={false}
                                data={[
                                  { value: "momentary", label: "Momentary" },
                                  { value: "toggle", label: "Toggle" },
                                ]}
                                value={propertyConfig.keyMode}
                                onChange={(value) =>
                                  patchKeyProperty({
                                    keyMode:
                                      value === "toggle"
                                        ? "toggle"
                                        : "momentary",
                                  })
                                }
                              />
                            </Group>
                            <Group justify="space-between" wrap="nowrap">
                              <Text size="sm">Down state</Text>
                              <Switch
                                size="sm"
                                checked={propertyConfig.downEnabled}
                                onChange={(event) => {
                                  const enabled = event.currentTarget.checked;
                                  patchKeyProperty({ downEnabled: enabled });
                                  if (!enabled) {
                                    setTargetStates((states) => ({
                                      ...states,
                                      [selectedKey]: "option",
                                    }));
                                    onPreviewDownTargetChange(null);
                                  }
                                }}
                              />
                            </Group>
                          </Stack>
                        </Tabs.Panel>
                        <Tabs.Panel value="up" pt="xl">
                          <Stack gap="sm">
                            <Group justify="space-between" wrap="nowrap">
                              <Text size="sm">Background color</Text>
                              <ColorInput
                                w={160}
                                size="xs"
                                format="hexa"
                                value={propertyConfig.upBackgroundColor}
                                onChange={(value) =>
                                  patchKeyProperty({ upBackgroundColor: value })
                                }
                              />
                            </Group>
                            <Group justify="space-between" wrap="nowrap">
                              <Text size="sm">Border</Text>
                              <Switch
                                size="sm"
                                checked={propertyConfig.upBorderEnabled}
                                onChange={(event) =>
                                  patchKeyProperty({
                                    upBorderEnabled: event.currentTarget.checked,
                                  })
                                }
                              />
                            </Group>
                            <Group justify="space-between" wrap="nowrap">
                              <Text size="sm">Border color</Text>
                              <ColorInput
                                w={160}
                                size="xs"
                                format="hex"
                                value={propertyConfig.upBorderColor}
                                disabled={!propertyConfig.upBorderEnabled}
                                onChange={(value) =>
                                  patchKeyProperty({ upBorderColor: value })
                                }
                              />
                            </Group>
                            <Group justify="space-between" wrap="nowrap">
                              <Text size="sm">Border size</Text>
                              <NumberInput
                                w={160}
                                size="xs"
                                min={1}
                                max={4}
                                allowDecimal={false}
                                clampBehavior="strict"
                                value={propertyConfig.upBorderWidth}
                                disabled={!propertyConfig.upBorderEnabled}
                                onChange={(value) =>
                                  patchKeyProperty({
                                    upBorderWidth:
                                      typeof value === "number" ? value : 1,
                                  })
                                }
                              />
                            </Group>
                          </Stack>
                        </Tabs.Panel>
                        {targetType === "key" && propertyConfig.downEnabled && (
                          <Tabs.Panel value="down" pt="xl">
                            <Stack gap="sm">
                              <Group justify="space-between" wrap="nowrap">
                                <Text size="sm">Background color</Text>
                                <ColorInput
                                  w={160}
                                  size="xs"
                                  format="hexa"
                                  value={propertyConfig.downBackgroundColor}
                                  onChange={(value) =>
                                    patchKeyProperty({
                                      downBackgroundColor: value,
                                    })
                                  }
                                />
                              </Group>
                              <Group justify="space-between" wrap="nowrap">
                                <Text size="sm">Border</Text>
                                <Switch
                                  size="sm"
                                  checked={propertyConfig.downBorderEnabled}
                                  onChange={(event) =>
                                    patchKeyProperty({
                                      downBorderEnabled:
                                        event.currentTarget.checked,
                                    })
                                  }
                                />
                              </Group>
                              <Group justify="space-between" wrap="nowrap">
                                <Text size="sm">Border color</Text>
                                <ColorInput
                                  w={160}
                                  size="xs"
                                  format="hex"
                                  value={propertyConfig.downBorderColor}
                                  disabled={!propertyConfig.downBorderEnabled}
                                  onChange={(value) =>
                                    patchKeyProperty({ downBorderColor: value })
                                  }
                                />
                              </Group>
                              <Group justify="space-between" wrap="nowrap">
                                <Text size="sm">Border size</Text>
                                <NumberInput
                                  w={160}
                                  size="xs"
                                  min={1}
                                  max={4}
                                  allowDecimal={false}
                                  clampBehavior="strict"
                                  value={propertyConfig.downBorderWidth}
                                  disabled={!propertyConfig.downBorderEnabled}
                                  onChange={(value) =>
                                    patchKeyProperty({
                                      downBorderWidth:
                                        typeof value === "number" ? value : 1,
                                    })
                                  }
                                />
                              </Group>
                            </Stack>
                          </Tabs.Panel>
                        )}
                      </Tabs>
                    </Accordion.Panel>
                  )}
                </Accordion.Item>
                </Accordion>
              </Box>

              {instances.length > 0 && (
                <Stack
                  key={`${selectedKey}-plugins`}
                  gap={0}
                  style={{ display: "contents" }}
                >
              {propertyGroups.map((group) => (
                <Box
                  key={group.category}
                  mt={group.category === "Render" ? 0 : 48}
                  style={{ order: group.category === "Render" ? 1 : 3 }}
                >
                  <Text size="xs" fw={600} c="dimmed" mb="xs" tt="uppercase">
                    {group.category}
                  </Text>
                  <Accordion multiple className="property-accordion">
              {group.items.map((item) => {
                const plugin = pluginById(item.plugin_id);
                if (!plugin) return null;
                const Editor = plugin.Editor;
                const summary = pluginSummary(item);
                const supportsDown =
                  targetType === "key" &&
                  plugin.capabilities.includes("render");
                const storedPropertyState = propertyStates[item.id] ?? "main";
                const propertyState =
                  !supportsDown && storedPropertyState === "down"
                    ? "up"
                    : storedPropertyState;
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
                        draggedPropertyId !== null &&
                        pluginById(
                          instances.find(
                            (instance) => instance.id === draggedPropertyId,
                          )?.plugin_id ?? "",
                        )?.category === plugin.category &&
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
                      } else {
                        setDropIndicator(null);
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
                        px={4}
                        py="sm"
                        onDragStart={(event) => {
                          event.stopPropagation();
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData(
                            "application/kbrd-property",
                            String(item.id),
                          );
                          setDraggedPropertyId(item.id);
                          setDragSymbol(event);
                        }}
                        onDragEnd={() => {
                          setDraggedPropertyId(null);
                          setDropIndicator(null);
                        }}
                      >
                        <MdDragIndicator
                          aria-label={`Move ${plugin.name}`}
                          style={{ cursor: "grab", display: "block" }}
                        />
                      </Box>
                      <Accordion.Control
                        style={{ flex: 1, paddingLeft: 0 }}
                      >
                        <Text truncate>
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
                          <Tabs.Tab value="main">Option</Tabs.Tab>
                          <Tabs.Tab value="up" disabled={!item.enabled}>
                            {supportsDown ? "Up" : "Main"}
                          </Tabs.Tab>
                          {supportsDown && down.enabled && (
                            <Tabs.Tab value="down" disabled={!item.enabled}>
                              Down
                            </Tabs.Tab>
                          )}
                        </Tabs.List>

                        <Tabs.Panel value="main" pt="xl">
                          <Stack gap="lg">
                            <Group justify="space-between" wrap="nowrap">
                              <Text size="sm">Disabled</Text>
                              <Switch
                                size="sm"
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
                            </Group>
                            {supportsDown && (
                              <Group justify="space-between" wrap="nowrap">
                                <Text size="sm">Down state</Text>
                                <Switch
                                  size="sm"
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
                              </Group>
                            )}
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

                        {supportsDown && down.enabled && (
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
                                  step={100}
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
                </Box>
              ))}
                </Stack>
              )}
            </Stack>
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
