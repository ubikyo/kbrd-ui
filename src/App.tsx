import {
  ActionIcon,
  AppShell,
  Box,
  Button,
  Group,
  Menu,
  Modal,
  Notification,
  SegmentedControl,
  Splitter,
  Stack,
  Switch,
  Text,
} from "@mantine/core";

import {
  MdAdd,
  MdCallMerge,
  MdCallSplit,
  MdContentCopy,
  MdContentPaste,
  MdDelete,
  MdDriveFileMove,
  MdEdit,
  MdGridOn,
  MdSettings,
} from "react-icons/md";

import { useCallback, useEffect, useRef, useState } from "react";

import kbrdLogo from "./assets/media/KBRD.svg";

import Layout from "./components/Layout";
import LayoutEditorModal from "./components/modals/LayoutEditorModal";
import DivideModal from "./components/modals/DivideModal";
import type {
  FactoryLayout,
  LayoutData,
} from "./types/layout";

import Factory from "./components/Factory";
import type { ContextMenuTarget } from "./components/Factory";
import Inspector from "./components/Inspector";
import SettingsModal from "./components/modals/SettingsModal";
import Layer from "./components/Layer";
import LayerEditorModal from "./components/modals/LayerEditorModal";
import { updateFactoryLayout } from "./api/layers";
import { maxItems } from "./utils/layout";
import type { LayerData } from "./types/layer";
import { useDisplaySettings } from "./classes/useDisplaySettings";
import { useEntityEditors } from "./classes/useEntityEditors";
import { useFactoryGrid } from "./classes/useFactoryGrid";
import { useKeyOperations } from "./classes/useKeyOperations";
import { useLayoutShortcuts } from "./classes/useLayoutShortcuts";
import { useUndoHistory } from "./classes/useUndoHistory";

// How long `<Factory>`'s grid sits idle before its disposition is
// autosaved onto the current layout — see the effect below.
const FACTORY_LAYOUT_AUTOSAVE_MS = 600;

// The Actions menu's own shortcuts are shown next to their label in
// whichever form this platform actually uses — ⌘ on macOS, Ctrl+
// elsewhere (both are accepted either way, see `useLayoutShortcuts`).
const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);
const MOD_KEY_LABEL = IS_MAC ? "⌘" : "Ctrl+";

function ShortcutHint({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" c="dimmed">
      {children}
    </Text>
  );
}

export default function App() {
  const [layout, setLayout] = useState<LayoutData | null>(null);
  const { layoutSettings, setLayoutSettings, saveDisplaySettings } =
    useDisplaySettings();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [layer, setLayer] = useState<LayerData | null>(null);

  const [settingsOpened, setSettingsOpened] = useState(false);

  // Which form the Inspector's plugin editors show — see `mode` on
  // `Inspector`'s props and each plugin's `LayoutEditor`/`MappingEditor`.
  const [mode, setMode] = useState<"layout" | "mapping">("layout");

  const [divideModalOpened, setDivideModalOpened] = useState(false);
  // The display's own right-click context menu — replaces the old floating
  // "Actions" button. `Factory` reports where the cursor was and what it
  // landed on (already selected the same way a left click would by the
  // time this fires); only the position and which content to show
  // (`kind`) need to live here, since `useFactoryGrid`'s own selection
  // state is already the source of truth for *which* cell, division, row
  // or the display itself is the real target.
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    kind: ContextMenuTarget["kind"];
  } | null>(null);
  const [inspectorTab, setInspectorTab] = useState<string | null>("plugins");
  // TODO(preview-rebuild): only the setters are used until <Factory> reads
  // these back to force-render a key/plugin's down state, as <Preview> did.
  const [, setPreviewDownPluginId] = useState<number | null>(null);
  const [, setPreviewDownTarget] = useState<string | null>(null);
  // Mirrors `layer` for the autosave effect below, so that effect only
  // has to depend on the grid state that actually triggers a save — not
  // on `layer` itself, which the save's own response also updates.
  const layerRef = useRef<LayerData | null>(null);
  // Mirrors `layout` so `changeLayout` can tell a genuine switch (a
  // different layout's id) from a same-layout refresh (the Layout editor's
  // `onSaved` re-fetching this same layout after an edit) — see there.
  const layoutRef = useRef<LayoutData | null>(null);

  const computedGridItemsY = maxItems(
    layoutSettings.physicalHeightMm,
    layoutSettings.unitMm,
    layoutSettings.gapMm,
  );
  // The current layout's own Max height (1U) override — see the Layout
  // editor's Geometry tab — clamped to what actually still fits in case
  // Caps size/Gap size/the display's own size changed since it was set.
  const gridItemsY =
    layout?.max_rows != null
      ? Math.min(layout.max_rows, computedGridItemsY)
      : computedGridItemsY;

  // `<Factory>`'s whole grid — cells, rows, merges, and every selection
  // (cell/division/row/display) — plus every operation that reads or
  // writes them; see its own comment for why selection lives there too.
  const grid = useFactoryGrid({ layoutSettings, gridItemsY });

  const { undo } = useUndoHistory({
    cells: grid.cells,
    rowOverrides: grid.rowOverrides,
    mergeGroups: grid.mergeGroups,
    skipAutosaveRef: grid.skipAutosaveRef,
    setCells: grid.setCells,
    setRowOverrides: grid.setRowOverrides,
    setMergeGroups: grid.setMergeGroups,
    clearCellSelection: grid.clearCellSelection,
  });

  const keyOps = useKeyOperations({
    layer,
    selectedKey,
    setLayer,
    onPreviewDownPluginChange: setPreviewDownPluginId,
    onPreviewDownTargetChange: setPreviewDownTarget,
  });

  const entityEditors = useEntityEditors({ layout, layer });

  const { resizeEnabled, setResizeEnabled } = useLayoutShortcuts({
    mode,
    settingsOpened,
    layoutEditorOpened: entityEditors.layoutEditorOpened,
    layerEditorOpened: entityEditors.layerEditorOpened,
    confirmDeleteOpen: Boolean(entityEditors.confirmDelete),
    divideModalOpened,
    hasCellSelection: grid.hasCellSelection,
    hasDivisionSelection: grid.hasDivisionSelection,
    canCopySelection: grid.canCopySelection,
    emptySelection: grid.emptySelection,
    undo,
    deleteSelectedCells: grid.deleteSelectedCells,
    deleteSelectedDivisions: grid.deleteSelectedDivisions,
    copySelectedCell: grid.copySelectedCell,
    pasteToEmptyRow: grid.pasteToEmptyRow,
  });

  const changeLayout = useCallback(
    (value: LayoutData | null) => {
      // The Layout editor's `onSaved` refreshes this same layout's own row
      // (e.g. a changed Max width/height, Caps size…) by re-fetching it, not
      // by switching to a different one — `Layout.refresh(id)` calls this
      // with a freshly-fetched object that still carries the same `id`. The
      // active layer and everything on the display must survive that; only
      // an actual switch (a different id, or none at all) should wipe them.
      const isSameLayout =
        layoutRef.current !== null &&
        value !== null &&
        layoutRef.current.id === value.id;
      setLayout(value);
      layoutRef.current = value;
      // Each layout keeps its own Caps size / Gap size — load them back in
      // now that we've switched to it, or reset to the reference panel once
      // there's no layout left to show them for. The physical screen's
      // width/height are *not* touched here (see `useDisplaySettings`):
      // they're the same for every layout, not per-layout.
      setLayoutSettings((current) => ({
        ...current,
        unitMm: value?.unit_mm ?? current.unitMm,
        gapMm: value?.gap_mm ?? current.gapMm,
      }));
      if (isSameLayout) return;
      setLayer(null);
      layerRef.current = null;
      setSelectedKey(null);
      keyOps.stopKeyOperation();
      setPreviewDownPluginId(null);
      setPreviewDownTarget(null);
      // The layer `<Layer>` activates next (see its effect) seeds
      // these back in via `changeLayer` — this is just the gap between
      // layouts.
      grid.loadFactoryLayout(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const changeLayer = useCallback(
    (value: LayerData | null) => {
      setLayer(value);
      layerRef.current = value;
      setSelectedKey(null);
      keyOps.stopKeyOperation();
      setPreviewDownPluginId(null);
      setPreviewDownTarget(null);
      // Each layer keeps its own `<Factory>` disposition — load it back
      // in now that we've switched to it.
      grid.loadFactoryLayout(value?.factory_layout ?? null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // `Factory`'s `onContextMenu` — a right-click anywhere on the display.
  // `Factory` has already made whatever selection this right-click
  // implies by the time this fires (preserving a multi-selection the
  // clicked cell/division was already part of, rather than always
  // collapsing it to just that one — see its own context-menu handlers),
  // so this only needs to open the menu itself, at the click.
  function handleContextMenu(x: number, y: number, target: ContextMenuTarget) {
    setContextMenu({ x, y, kind: target.kind });
  }

  // The browser's own right-click context menu is never wanted anywhere
  // in the app — `Factory` already shows its own (see `contextMenu`
  // above) for a cell/division/row/display in Layout mode, but this covers
  // every other case too (Mapping mode, the header, the Inspector panel,
  // Settings…), where nothing else calls `preventDefault()` on it.
  useEffect(() => {
    function handleContextMenu(event: MouseEvent) {
      event.preventDefault();
    }
    window.addEventListener("contextmenu", handleContextMenu);
    return () => window.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  function changePlugins(plugins: LayerData["plugins"]) {
    setLayer((value) => (value ? { ...value, plugins } : null));
  }

  function changeKeyProperties(keyProperties: LayerData["key_properties"]) {
    setLayer((value) =>
      value ? { ...value, key_properties: keyProperties } : null,
    );
  }

  // TODO(preview-rebuild): dropping a plugin onto a key and completing a
  // duplicate/move operation both used to happen by clicking a key in
  // <Preview>. Restore that wiring (see git history / Preview.tsx) once
  // <Factory> exposes clickable key/drop targets of its own.

  // Autosaves `<Factory>`'s disposition onto the current layer's own
  // `factory_layout` — debounced so a drag-resize or a run of clicks
  // doesn't fire one PUT per change. Skipped for the run right after
  // `changeLayer` seeds this same state from what's already saved (see
  // `grid.skipAutosaveRef`), and reads `layerRef` rather than `layer` so
  // this save's own response (a fresh `setLayer`) doesn't re-trigger
  // itself.
  useEffect(() => {
    const current = layerRef.current;
    if (!current) return;
    if (grid.skipAutosaveRef.current) {
      grid.skipAutosaveRef.current = false;
      return;
    }
    const factoryLayout: FactoryLayout = {
      rowOverrides: grid.rowOverrides,
      cells: grid.cells,
      mergeGroups: grid.mergeGroups,
    };
    const timeout = setTimeout(() => {
      void updateFactoryLayout(current.id, factoryLayout).then((updated) => {
        setLayer(updated);
        layerRef.current = updated;
      });
    }, FACTORY_LAYOUT_AUTOSAVE_MS);
    return () => clearTimeout(timeout);
  }, [grid.cells, grid.rowOverrides, grid.mergeGroups, grid.skipAutosaveRef]);

  return (
    <AppShell header={{ height: 64 }} padding={0}>
      <AppShell.Header
        bg="var(--kbrd-color-body)"
        style={{
          borderBottom: "1px solid var(--kbrd-border-color)",
        }}
      >
        <Group h="100%" gap={0}>
          <Box
            w={86}
            h="100%"
            px="xs"
            style={{
              display: "flex",
              alignItems: "center",
              boxSizing: "border-box",
            }}
          >
            <img
              src={kbrdLogo}
              alt="KBRD"
              style={{
                width: "100%",
                maxWidth: "100%",
                height: "auto",
                display: "block",
              }}
            />
          </Box>

          <Layout
            ref={entityEditors.layoutMenuRef}
            onChange={changeLayout}
            onAdd={entityEditors.openAddLayout}
          />
          {layout && (
            <Layer
              key={layout.id}
              ref={entityEditors.layerMenuRef}
              layoutId={layout.id}
              onChange={changeLayer}
              onAdd={entityEditors.openAddLayer}
            />
          )}

          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            ml="auto"
            mr="md"
            aria-label="Settings"
            onClick={() => setSettingsOpened(true)}
          >
            <MdSettings size={20} />
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <SettingsModal
        opened={settingsOpened}
        onClose={() => setSettingsOpened(false)}
        settings={layoutSettings}
        onSave={saveDisplaySettings}
      />

      <AppShell.Main
        bg="var(--kbrd-color-body)"
        style={{
          height: "100vh",
        }}
      >
        <Splitter
          orientation="horizontal"
          lineSize={1}
          handleColor="var(--kbrd-border-color)"
          style={{
            position: "relative",
            height: "calc(100vh - 64px)",
            overflow: "hidden",
          }}
        >
          <Splitter.Pane defaultSize={75} min={40}>
            <Box h="100%" style={{ position: "relative", overflow: "hidden" }}>
              {/* TODO(preview-rebuild): Factory temporarily stands in for
                  Preview while that component is redesigned from scratch. */}
              <Factory
                {...layoutSettings}
                mode={mode}
                rows={grid.rows}
                cells={grid.cells}
                onCellsChange={grid.setCells}
                onCreateCell={grid.createCell}
                onMoveCell={grid.moveCell}
                mergeGroups={grid.mergeGroups}
                selectedCellIndices={grid.selectedCellIndices}
                onSelectCell={grid.selectCell}
                onToggleCell={grid.toggleCellSelection}
                selectedEmptyRow={grid.selectedEmptyRow}
                onSelectEmpty={grid.selectEmptyRow}
                selectedDivisionIndices={grid.selectedDivisionIndices}
                onSelectDivision={grid.selectDivision}
                onToggleDivision={grid.toggleDivisionSelection}
                isDisplaySelected={grid.displaySelected}
                onSelectDisplay={grid.selectDisplay}
                onContextMenu={handleContextMenu}
                resizeEnabled={resizeEnabled}
                maxColumns={layout?.max_columns ?? null}
              />

              <SegmentedControl
                value={mode}
                onChange={(value) =>
                  setMode(value === "mapping" ? "mapping" : "layout")
                }
                data={[
                  { label: "Layout", value: "layout" },
                  { label: "Mapping", value: "mapping" },
                ]}
                color="green"
                size="xs"
                style={{
                  position: "absolute",
                  left: 20,
                  bottom: 20,
                  zIndex: 20,
                }}
              />

              {/* Moved out of the display's own Actions menu — resizing is a
                  view option, not a per-layout action, so it lives here as
                  a persistent switch, aligned right at the same level as
                  the Layout/Mapping switch on the left. Also toggled by
                  Tab (see `useLayoutShortcuts`) — Layout mode only: Mapping
                  mode has no row/cell structure to resize in the first
                  place, so the switch (and whatever it was left at) is
                  hidden rather than just disabled. */}
              {mode === "layout" && (
                <Switch
                  label="Resize"
                  size="xs"
                  color="green"
                  checked={resizeEnabled}
                  onChange={(event) =>
                    setResizeEnabled(event.currentTarget.checked)
                  }
                  style={{
                    position: "absolute",
                    right: 20,
                    bottom: 20,
                    zIndex: 20,
                  }}
                />
              )}

              {/* One shared right-click context menu (see `Factory`'s
                  `onContextMenu` and `handleContextMenu` above) — its
                  content switches on `contextMenu.kind`, reading whichever
                  selection `useFactoryGrid` already made for it the same
                  way each used to feed its own floating "Actions" button.
                  Anchored to an invisible, zero-size target positioned at
                  the click itself instead of a fixed on-screen spot, so it
                  opens right where the cursor was. */}
              {contextMenu && (
                <Menu
                  opened
                  onChange={(opened) => {
                    if (!opened) setContextMenu(null);
                  }}
                  position="bottom-start"
                  offset={0}
                  width={200}
                  styles={{ item: { padding: "4px var(--mantine-spacing-sm)" } }}
                >
                  <Menu.Target>
                    <div
                      style={{
                        position: "fixed",
                        left: contextMenu.x,
                        top: contextMenu.y,
                        width: 0,
                        height: 0,
                      }}
                    />
                  </Menu.Target>
                  <Menu.Dropdown>
                    {contextMenu.kind === "cell" &&
                      mode === "layout" &&
                      grid.selectedCellIndices.length > 0 && (
                        <>
                          {grid.selectedCellIndices.length === 1 &&
                            grid.layoutSelection && (
                              <>
                                {grid.layoutSelection.isMerged && (
                                  <Menu.Item leftSection={<MdCallSplit />} onClick={grid.unmerge}>
                                    Unmerge
                                  </Menu.Item>
                                )}
                                {!grid.layoutSelection.isMerged &&
                                  !grid.layoutSelection.cell.divide && (
                                    <Menu.Item
                                      leftSection={<MdGridOn />}
                                      onClick={() => setDivideModalOpened(true)}
                                    >
                                      Divide
                                    </Menu.Item>
                                  )}
                                <Menu.Divider />
                                <Menu.Item
                                  leftSection={<MdContentCopy />}
                                  rightSection={<ShortcutHint>{MOD_KEY_LABEL}C</ShortcutHint>}
                                  onClick={grid.copySelectedCell}
                                >
                                  Copy
                                </Menu.Item>
                                {grid.layoutSelection.canRemove && (
                                  <Menu.Item
                                    color="red"
                                    leftSection={<MdDelete />}
                                    rightSection={<ShortcutHint>⌫</ShortcutHint>}
                                    onClick={() => grid.removeCell(grid.layoutSelection!.index)}
                                  >
                                    Delete
                                  </Menu.Item>
                                )}
                              </>
                            )}
                          {grid.selectedCellIndices.length > 1 &&
                            grid.isCellSelectionContiguous && (
                              <>
                                <Menu.Item
                                  leftSection={<MdCallMerge />}
                                  onClick={grid.mergeSelectedCells}
                                >
                                  Merge
                                </Menu.Item>
                                <Menu.Item
                                  color="red"
                                  leftSection={<MdDelete />}
                                  rightSection={<ShortcutHint>⌫</ShortcutHint>}
                                  onClick={grid.deleteSelectedCells}
                                >
                                  Delete
                                </Menu.Item>
                              </>
                            )}
                          {grid.selectedCellIndices.length > 1 &&
                            !grid.isCellSelectionContiguous && (
                              <Menu.Item
                                color="red"
                                leftSection={<MdDelete />}
                                rightSection={<ShortcutHint>⌫</ShortcutHint>}
                                onClick={grid.deleteSelectedCells}
                              >
                                Delete
                              </Menu.Item>
                            )}
                        </>
                      )}

                    {contextMenu.kind === "division" &&
                      mode === "layout" &&
                      grid.selectedDivisionIndices.length > 0 && (
                        <>
                          {grid.selectedDivisionIndices.length === 1 &&
                            grid.divisionSelection && (
                              <>
                                {grid.divisionSelection.isMerged && (
                                  <Menu.Item
                                    leftSection={<MdCallSplit />}
                                    onClick={grid.unmergeDivision}
                                  >
                                    Unmerge
                                  </Menu.Item>
                                )}
                                {grid.divisionSelection.cell.typeId && (
                                  <Menu.Item
                                    color="red"
                                    leftSection={<MdDelete />}
                                    rightSection={<ShortcutHint>⌫</ShortcutHint>}
                                    onClick={grid.deleteSelectedDivisions}
                                  >
                                    Delete
                                  </Menu.Item>
                                )}
                              </>
                            )}
                          {grid.selectedDivisionIndices.length > 1 &&
                            grid.isDivisionSelectionContiguous && (
                              <>
                                <Menu.Item
                                  leftSection={<MdCallMerge />}
                                  onClick={grid.mergeSelectedDivisions}
                                >
                                  Merge
                                </Menu.Item>
                                <Menu.Item
                                  color="red"
                                  leftSection={<MdDelete />}
                                  rightSection={<ShortcutHint>⌫</ShortcutHint>}
                                  onClick={grid.deleteSelectedDivisions}
                                >
                                  Delete
                                </Menu.Item>
                              </>
                            )}
                          {grid.selectedDivisionIndices.length > 1 &&
                            !grid.isDivisionSelectionContiguous && (
                              <Menu.Item
                                color="red"
                                leftSection={<MdDelete />}
                                rightSection={<ShortcutHint>⌫</ShortcutHint>}
                                onClick={grid.deleteSelectedDivisions}
                              >
                                Delete
                              </Menu.Item>
                            )}
                        </>
                      )}

                    {contextMenu.kind === "row" &&
                      mode === "layout" &&
                      grid.emptySelection && (
                        <Menu.Item
                          leftSection={<MdContentPaste />}
                          rightSection={<ShortcutHint>{MOD_KEY_LABEL}V</ShortcutHint>}
                          disabled={!grid.emptySelection.canPaste}
                          onClick={grid.pasteToEmptyRow}
                        >
                          Paste
                        </Menu.Item>
                      )}

                    {contextMenu.kind === "display" && (
                      <>
                        <Menu.Label>Layout</Menu.Label>
                        <Menu.Item leftSection={<MdAdd />} onClick={entityEditors.openAddLayout}>
                          Add
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<MdEdit />}
                          disabled={!layout}
                          onClick={entityEditors.openEditLayout}
                        >
                          Edit
                        </Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<MdDelete />}
                          disabled={!layout}
                          onClick={entityEditors.requestDeleteLayout}
                        >
                          Delete
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Label>Layer</Menu.Label>
                        <Menu.Item
                          leftSection={<MdAdd />}
                          disabled={!layout}
                          onClick={entityEditors.openAddLayer}
                        >
                          Add
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<MdEdit />}
                          disabled={!layer}
                          onClick={entityEditors.openEditLayer}
                        >
                          Edit
                        </Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<MdDelete />}
                          disabled={!layer}
                          onClick={entityEditors.requestDeleteLayer}
                        >
                          Delete
                        </Menu.Item>
                      </>
                    )}
                  </Menu.Dropdown>
                </Menu>
              )}
            </Box>
          </Splitter.Pane>
          <Splitter.Pane defaultSize="550px" min="550px">
            <Inspector
              layer={layer}
              selectedKey={selectedKey}
              layout={layout?.layout ?? null}
              mode={mode}
              layoutSelection={
                grid.divisionSelection
                  ? { index: grid.divisionSelection.subId, cell: grid.divisionSelection.cell }
                  : grid.layoutSelection
              }
              onLayoutCellChange={
                grid.divisionSelection
                  ? (subId, patch) =>
                      grid.changeDivisionCell(grid.divisionSelection!.parentId, subId, patch)
                  : grid.changeCell
              }
              tab={inspectorTab}
              onTabChange={setInspectorTab}
              onChange={changePlugins}
              onKeyPropertiesChange={changeKeyProperties}
              onPreviewDownPluginChange={setPreviewDownPluginId}
              onPreviewDownTargetChange={setPreviewDownTarget}
              onDuplicateFrom={keyOps.startDuplicateFrom}
              onDuplicateTo={keyOps.startDuplicateTo}
              onMoveTo={keyOps.startMoveTo}
              onClearAll={keyOps.clearSelectedKey}
            />
          </Splitter.Pane>
        </Splitter>
      </AppShell.Main>
      {keyOps.keyOperation && (
        <Notification
          icon={
            keyOps.keyOperation.direction === "move" ? (
              <MdDriveFileMove size={18} />
            ) : (
              <MdContentCopy size={18} />
            )
          }
          title={
            keyOps.keyOperation.direction === "from"
              ? "Duplicate from"
              : keyOps.keyOperation.direction === "to"
                ? "Duplicate to"
                : "Move to"
          }
          onClose={keyOps.stopKeyOperation}
          withBorder
          style={{
            position: "fixed",
            left: 20,
            bottom: 20,
            zIndex: 1000,
          }}
        >
          <Group gap="md" wrap="nowrap">
            <Text size="sm">
              {keyOps.keyOperation.direction === "from"
                ? "Click the source key to duplicate."
                : keyOps.keyOperation.direction === "to"
                  ? "Click each destination key to duplicate."
                  : "Click the destination key to move."}
            </Text>
            <Button size="compact-xs" color="red" onClick={keyOps.stopKeyOperation}>
              STOP
            </Button>
          </Group>
        </Notification>
      )}
      {divideModalOpened && grid.layoutSelection && (
        <DivideModal
          onClose={() => setDivideModalOpened(false)}
          onDivide={(cols, rows) => {
            grid.divideSelectedCell(cols, rows);
            setDivideModalOpened(false);
          }}
        />
      )}
      {entityEditors.layoutEditorOpened && (
        <LayoutEditorModal
          editing={entityEditors.editingLayout}
          onClose={() => entityEditors.setLayoutEditorOpened(false)}
          onSaved={(id) => {
            entityEditors.setLayoutEditorOpened(false);
            void entityEditors.layoutMenuRef.current?.refresh(id);
          }}
        />
      )}
      {entityEditors.layerEditorOpened && layout && (
        <LayerEditorModal
          layoutId={layout.id}
          editing={entityEditors.editingLayer}
          onClose={() => entityEditors.setLayerEditorOpened(false)}
          onSaved={(id) => {
            entityEditors.setLayerEditorOpened(false);
            void entityEditors.layerMenuRef.current?.refresh(id);
          }}
        />
      )}
      {entityEditors.confirmDelete && (
        <Modal
          opened
          onClose={() => entityEditors.setConfirmDelete(null)}
          title={
            <Text fw={700}>
              Delete {entityEditors.confirmDelete.kind === "layout" ? "layout" : "layer"}
            </Text>
          }
          centered
          size="sm"
        >
          <Stack>
            <Text>
              Delete {entityEditors.confirmDelete.kind === "layout" ? "layout" : "layer"}{" "}
              <Text component="span" fw={600}>
                {entityEditors.confirmDelete.name}
              </Text>
              ?
            </Text>
            <Text size="sm" c="dimmed">
              This action cannot be undone.
            </Text>
            <Group justify="flex-end">
              <Button color="gray" onClick={() => entityEditors.setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                color="red"
                leftSection={<MdDelete size={16} />}
                onClick={() => void entityEditors.confirmDeleteNow()}
              >
                Delete
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </AppShell>
  );
}
