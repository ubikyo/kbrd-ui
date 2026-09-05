import {
  Accordion,
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Modal,
  NumberInput,
  Stack,
  Switch,
  Tabs,
  Text,
} from "@mantine/core";
import {
  MdContentCopy,
  MdDelete,
  MdDragIndicator,
  MdDriveFileMove,
  MdMoreVert,
} from "react-icons/md";
import { PropertyRow } from "@kbrd/plugins/web";

import { pluginSummary, setDragSymbol } from "../classes/inspectorHelpers";
import { useKeyInspector } from "../classes/useKeyInspector";
import { pluginById } from "../plugins/registry";
import { downState, upConfig } from "../plugins/state";
import type { GridCell, KeyboardLayout } from "../types/layout";
import KeyStateFields from "./KeyStateFields";
import LayoutCellProperties from "./LayoutCellProperties";
import type { KeyPlugin, KeyProperty, LayerData } from "../types/layer";

type Props = {
  layer: LayerData | null;
  selectedKey: string | null;
  tab: string | null;
  onTabChange: (tab: string | null) => void;
  onChange: (plugins: KeyPlugin[]) => void;
  layout: KeyboardLayout | null;
  // Which form each plugin instance below shows: its Layout (placement) or
  // Mapping (everything else) editor — see `kbrd-plugins`' per-plugin
  // `LayoutEditor`/`MappingEditor` exports.
  mode: "layout" | "mapping";
  // The `<Display>` grid cell (or division of a divided one) currently
  // selected, only set in Layout mode — `cell` only needs to carry the
  // plugin-facing fields `LayoutCellProperties` actually reads, the same
  // for either kind of selection (see its own `PluginCell`).
  layoutSelection: {
    index: number;
    cell: Pick<GridCell, "typeId" | "typeConfig">;
  } | null;
  onLayoutCellChange: (
    index: number,
    patch: Partial<Pick<GridCell, "typeId" | "typeConfig">>,
  ) => void;
  onKeyPropertiesChange: (properties: KeyProperty[]) => void;
  onPreviewDownPluginChange: (pluginId: number | null) => void;
  onPreviewDownTargetChange: (keyRef: string | null) => void;
  onDuplicateFrom: () => void;
  onDuplicateTo: () => void;
  onMoveTo: () => void;
  onClearAll: () => Promise<void>;
};

/**
 * Layout-mode Properties tab content for a selected `<Display>` cell, or
 * Mapping-mode's Plugins/Properties tabs for `selectedKey` — see
 * `useKeyInspector` for everything behind the latter (which plugins/
 * properties a key has, and every mutation on them).
 */
export default function Inspector({
  layer,
  selectedKey,
  tab,
  onTabChange,
  onChange,
  layout,
  mode,
  layoutSelection,
  onLayoutCellChange,
  onKeyPropertiesChange,
  onPreviewDownPluginChange,
  onPreviewDownTargetChange,
  onDuplicateFrom,
  onDuplicateTo,
  onMoveTo,
  onClearAll,
}: Props) {
  const inspector = useKeyInspector({
    layer,
    selectedKey,
    layout,
    mode,
    onChange,
    onKeyPropertiesChange,
    onPreviewDownPluginChange,
    onPreviewDownTargetChange,
    onMoveTo,
    onClearAll,
  });
  const {
    propertyStates,
    setPropertyStates,
    deleting,
    setDeleting,
    clearing,
    setClearing,
    setTargetStates,
    dropIndicator,
    setDropIndicator,
    draggedPropertyId,
    setDraggedPropertyId,
    draggablePlugins,
    pluginCategories,
    instances,
    propertyGroups,
    propertyConfig,
    targetType,
    targetState,
    systemPluginName,
    patchKeyProperty,
    patch,
    reorder,
    remove,
    clearAll,
    startMoveTo,
  } = inspector;

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
          {!layer ? (
            <Text c="dimmed">
              {layout
                ? "Create a layer to add plugins."
                : "Create a layout to add plugins."}
            </Text>
          ) : (
            <Accordion multiple defaultValue={pluginCategories}>
              {pluginCategories.map(
                (category) => {
                  const categoryPlugins = draggablePlugins.filter(
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
          {mode === "layout" ? (
            !layoutSelection ? (
              <Text c="dimmed">No key selected</Text>
            ) : (
              <LayoutCellProperties
                cell={layoutSelection.cell}
                onChange={(patch) =>
                  onLayoutCellChange(layoutSelection.index, patch)
                }
              />
            )
          ) : !selectedKey ? (
            <Text c="dimmed">No key selected</Text>
          ) : (
            <Stack gap={0}>
              {targetType === "key" && (
                <Group justify="flex-end" mb="md">
                  <Menu position="bottom-end" width={180}>
                    <Menu.Target>
                      <Button
                        variant="subtle"
                        color="gray"
                        size="xs"
                        leftSection={<MdMoreVert />}
                      >
                        Actions
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<MdContentCopy />}
                        onClick={onDuplicateFrom}
                      >
                        Duplicate from
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<MdContentCopy />}
                        onClick={onDuplicateTo}
                      >
                        Duplicate to
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<MdDriveFileMove />}
                        onClick={() => void startMoveTo()}
                      >
                        Move to
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        leftSection={<MdDelete />}
                        onClick={() => setClearing(true)}
                      >
                        Clear all
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              )}
              <Box key={`${selectedKey}-system`} style={{ order: 2 }}>
                {!propertyGroups.some(
                  (group) => group.category === "Display",
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
                            <PropertyRow label="Enable down state ?" align="center" compactControl>
                              <Switch
                                aria-label="Enable down state ?"
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
                            </PropertyRow>
                          </Stack>
                        </Tabs.Panel>
                        <Tabs.Panel value="up" pt="xl">
                          <KeyStateFields
                            backgroundColor={propertyConfig.upBackgroundColor}
                            borderEnabled={propertyConfig.upBorderEnabled}
                            borderColor={propertyConfig.upBorderColor}
                            borderWidth={propertyConfig.upBorderWidth}
                            onBackgroundColorChange={(value) =>
                              patchKeyProperty({ upBackgroundColor: value })
                            }
                            onBorderEnabledChange={(value) =>
                              patchKeyProperty({ upBorderEnabled: value })
                            }
                            onBorderColorChange={(value) =>
                              patchKeyProperty({ upBorderColor: value })
                            }
                            onBorderWidthChange={(value) =>
                              patchKeyProperty({ upBorderWidth: value })
                            }
                          />
                        </Tabs.Panel>
                        {targetType === "key" && propertyConfig.downEnabled && (
                          <Tabs.Panel value="down" pt="xl">
                            <KeyStateFields
                              backgroundColor={
                                propertyConfig.downBackgroundColor
                              }
                              borderEnabled={propertyConfig.downBorderEnabled}
                              borderColor={propertyConfig.downBorderColor}
                              borderWidth={propertyConfig.downBorderWidth}
                              onBackgroundColorChange={(value) =>
                                patchKeyProperty({ downBackgroundColor: value })
                              }
                              onBorderEnabledChange={(value) =>
                                patchKeyProperty({ downBorderEnabled: value })
                              }
                              onBorderColorChange={(value) =>
                                patchKeyProperty({ downBorderColor: value })
                              }
                              onBorderWidthChange={(value) =>
                                patchKeyProperty({ downBorderWidth: value })
                              }
                            />
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
                  mt={group.category === "Display" ? 0 : 48}
                  style={{ order: group.category === "Display" ? 1 : 3 }}
                >
                  <Text size="xs" fw={600} c="dimmed" mb="xs" tt="uppercase">
                    {group.category}
                  </Text>
                  <Accordion multiple className="property-accordion">
              {group.items.map((item) => {
                const plugin = pluginById(item.plugin_id);
                if (!plugin) return null;
                // This branch of the Properties tab only renders in Mapping
                // mode — see the `mode === "layout"` split above.
                const Editor = plugin.MappingEditor;
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
                            <PropertyRow label="Disabled" align="center" compactControl>
                              <Switch
                                aria-label="Disabled"
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
                            </PropertyRow>
                            {supportsDown && (
                              <PropertyRow label="Enable down state ?" align="center" compactControl>
                                <Switch
                                  aria-label="Enable down state ?"
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
                              </PropertyRow>
                            )}
                          </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="up" pt="xl">
                          <Editor
                            config={up}
                            targetType={targetType}
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
                                targetType={targetType}
                                onChange={(config) => patchDown({ config })}
                              />
                              <PropertyRow label="Delay">
                                <NumberInput
                                  w="100%"
                                  aria-label="Delay"
                                  suffix=" ms"
                                  min={0}
                                  step={100}
                                  allowNegative={false}
                                  value={down.delay}
                                  success
                                  onChange={(value) =>
                                    patchDown({
                                      delay:
                                        typeof value === "number" ? value : 0,
                                    })
                                  }
                                />
                              </PropertyRow>
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
        opened={clearing}
        onClose={() => setClearing(false)}
        title={<Text fw={700}>Clear key</Text>}
        centered
        size="sm"
      >
        <Stack>
          <Text>
            Permanently clear all plugins and properties from this key?
          </Text>
          <Group justify="flex-end">
            <Button color="gray" onClick={() => setClearing(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<MdDelete size={16} />}
              onClick={() => void clearAll()}
            >
              Clear all
            </Button>
          </Group>
        </Stack>
      </Modal>

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
