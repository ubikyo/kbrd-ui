import { useState } from "react";
import {
  Accordion,
  ActionIcon,
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { MdDelete, MdDragIndicator } from "react-icons/md";

import { pluginSummary, setDragSymbol, setPluginDragImage } from "../classes/inspectorHelpers";
import { useKeyInspector } from "../classes/useKeyInspector";
import State from "./menu/State";
import {
  SYSTEM_PLUGIN_ID,
  isDeletable,
  pluginById,
} from "../plugins/registry";
import { stateConfig, withStateConfig } from "../plugins/state";
import type { GridCell } from "../types/layout";
import LayoutCellProperties from "./LayoutCellProperties";
import StateEditor from "./modals/StateEditor";
import type { KeyPlugin, KeyProperty, LayerData } from "../types/layer";

type Props = {
  layer: LayerData | null;
  selectedKey: string | null;
  tab: string | null;
  onTabChange: (tab: string | null) => void;
  onChange: (plugins: KeyPlugin[]) => void;
  // `selectedKey`'s own Layout plugin id (`kbrd.layout-key`/
  // `kbrd.layout-space`) — lets `useKeyInspector` tell a Key from a Space
  // for the system property row's own label, without a `layout`/geometry
  // lookup (see `App`'s own `selectedKeyTypeId`).
  selectedKeyTypeId: string | null;
  // Whether any layout is loaded at all — just for the empty-state
  // message below ("Create a layer"/"Create a layout"), not a real
  // `LayoutData` consumer.
  hasLayout: boolean;
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
  selectedKeyTypeId,
  hasLayout,
  mode,
  layoutSelection,
  onLayoutCellChange,
  onKeyPropertiesChange,
}: Props) {
  const inspector = useKeyInspector({
    layer,
    selectedKey,
    selectedKeyTypeId,
    mode,
    onChange,
    onKeyPropertiesChange,
  });
  const {
    deleting,
    setDeleting,
    dropIndicator,
    setDropIndicator,
    draggedPropertyId,
    setDraggedPropertyId,
    draggablePlugins,
    pluginCategories,
    instances,
    propertyConfig,
    targetType,
    systemPluginName,
    activeState,
    activeStateConfig,
    setActiveState,
    patchStateConfig,
    addState,
    renameState,
    deleteState,
    patch,
    reorder,
    remove,
  } = inspector;
  // The element's own form lives in a plugin like any other now
  // (`kbrd.render-key`), it's just not one that can be attached or
  // detached — see its manifest's `deletable` and `isDeletable`.
  const systemPlugin = pluginById(SYSTEM_PLUGIN_ID);
  const SystemEditor = systemPlugin?.MappingEditor;
  const systemPluginDeletable = systemPlugin ? isDeletable(systemPlugin) : true;
  // "add"/"edit" while the States menu's own modal is open, `null`
  // otherwise — see `StateEditor`.
  const [stateEditorMode, setStateEditorMode] = useState<"add" | "edit" | null>(
    null,
  );

  return (
    <Box
      h="100%"
      bg="var(--kbrd-color-body)"
      p={0}
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
              {hasLayout
                ? "Create a layer to add plugins."
                : "Create a layout to add plugins."}
            </Text>
          ) : (
            // `key={mode}` forces a fresh instance on every mode switch —
            // `defaultValue` is only ever read once, at mount, so without
            // this the categories left open/closed from Layout mode would
            // just carry straight over instead of reopening every one of
            // Mapping's own (`pluginCategories` itself already reacts to
            // `mode`, an uncontrolled Accordion's own expanded state
            // wouldn't otherwise).
            <Accordion
              key={mode}
              multiple
              className="plugin-accordion"
              defaultValue={pluginCategories}
            >
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
                            pl={10}
                            pr={10}
                            draggable
                            style={{
                              borderBottom:
                                categoryPlugins.length > 1 &&
                                index < categoryPlugins.length - 1
                                  ? "1px solid var(--kbrd-border-color)"
                                  : undefined,
                              // Without this, starting the drag with a
                              // left click paints a native text/element
                              // selection highlight over the row instead
                              // of (or alongside) the custom drag ghost.
                              userSelect: "none",
                              WebkitUserSelect: "none",
                              WebkitUserDrag: "element",
                            }}
                            onDragStart={(event) => {
                              // "move" (not "copy") so the browser's own
                              // cursor badge doesn't show a "+" — dropping
                              // a plugin here doesn't remove it from this
                              // list either way, "move" is just the cursor
                              // this app wants.
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData(
                                "application/kbrd-plugin",
                                plugin.id,
                              );
                              setPluginDragImage(event, plugin.name);
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
              <Text c="dimmed">No item selected</Text>
            ) : (
              <LayoutCellProperties
                cell={layoutSelection.cell}
                onChange={(patch) =>
                  onLayoutCellChange(layoutSelection.index, patch)
                }
              />
            )
          ) : !selectedKey ? (
            <Text c="dimmed">No item selected</Text>
          ) : (
            <Stack key={selectedKey} gap={0}>
              <Group justify="flex-end" mb="xs" pr={15}>
                <State
                  states={propertyConfig.states}
                  activeState={activeState}
                  onSelect={setActiveState}
                  onAdd={() => setStateEditorMode("add")}
                  onEdit={() => setStateEditorMode("edit")}
                  onDelete={() => deleteState(activeState)}
                />
              </Group>
              <Accordion multiple className="property-accordion">
                {instances.map((item) => {
                  const plugin = pluginById(item.plugin_id);
                  if (!plugin) return null;
                  // This branch of the Properties tab only renders in Mapping
                  // mode — see the `mode === "layout"` split above.
                  const Editor = plugin.MappingEditor;
                  const summary = pluginSummary(item);
                  const definedConfig = stateConfig(item.config, activeState);
                  const currentConfig = {
                    ...plugin.defaultConfig,
                    ...definedConfig,
                  };
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
                          pl={10}
                          pr={4}
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
                        <Editor
                          config={currentConfig}
                          definedConfig={definedConfig}
                          targetType={targetType}
                          onChange={(config) =>
                            patch(item, {
                              config: withStateConfig(item.config, activeState, config),
                            })
                          }
                        />
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
                <Accordion.Item value="system">
                  <Group
                    className="inspector-accordion-heading"
                    gap={0}
                    wrap="nowrap"
                  >
                    <Box
                      pl={10}
                      pr={4}
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
                      disabled={!systemPluginDeletable}
                      style={{ backgroundColor: "transparent" }}
                    >
                      <MdDelete />
                    </ActionIcon>
                  </Group>
                  {targetType === "key" && SystemEditor && (
                    <Accordion.Panel className="property-editor-panel">
                      <SystemEditor
                        config={activeStateConfig}
                        targetType={targetType}
                        onChange={(config) => patchStateConfig(config)}
                      />
                    </Accordion.Panel>
                  )}
                </Accordion.Item>
              </Accordion>
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

      {stateEditorMode && (
        <StateEditor
          mode={stateEditorMode}
          states={propertyConfig.states}
          editingState={stateEditorMode === "edit" ? activeState : undefined}
          onClose={() => setStateEditorMode(null)}
          onSubmit={(name, copyFrom) => {
            if (stateEditorMode === "add") addState(name, copyFrom);
            else renameState(activeState, name, copyFrom);
            setStateEditorMode(null);
          }}
        />
      )}
    </Box>
  );
}
