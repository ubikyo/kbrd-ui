import {
  ActionIcon,
  AppShell,
  Box,
  Button,
  Group,
  Modal,
  Notification,
  Splitter,
  Stack,
  Text,
} from "@mantine/core";

import { MdContentCopy, MdDelete, MdDriveFileMove, MdSettings } from "react-icons/md";

import { useCallback, useEffect, useRef, useState } from "react";

import kbrdLogo from "./assets/media/KBRD.svg";

import Layout from "./components/menu/Layout";
import LayoutEditor from "./components/modals/LayoutEditor";
import type { FactoryLayout, LayoutData } from "./types/layout";

import Composer from "./components/Composer";
import Inspector from "./components/Inspector";
import Settings from "./components/modals/Settings";
import Layer from "./components/menu/Layer";
import LayerEditor from "./components/modals/LayerEditor";
import { updateFactoryLayout } from "./api/layers";
import { maxItems } from "./utils/layout";
import type { LayerData } from "./types/layer";
import { useDisplayGrid } from "./classes/useDisplayGrid";
import { useDisplaySettings } from "./classes/useDisplaySettings";
import { useEntityEditors } from "./classes/useEntityEditors";
import { useKeyOperations } from "./classes/useKeyOperations";

// How long `<Display>`'s grid sits idle before its disposition is
// autosaved onto the current layout — see the effect below.
const FACTORY_LAYOUT_AUTOSAVE_MS = 600;

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

  const [inspectorTab, setInspectorTab] = useState<string | null>("plugins");
  // TODO(preview-rebuild): only the setters are used until <Display> reads
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

  // `<Display>`'s whole grid — cells, rows, merges, and every selection
  // (cell/division/row/display) — plus every operation that reads or
  // writes them. Read directly by `Inspector` (the Properties tab) as
  // well as `<Composer>` (the display's own chrome/shortcuts/undo), so it
  // stays lifted here rather than inside either one.
  const grid = useDisplayGrid({ layoutSettings, gridItemsY });

  const keyOps = useKeyOperations({
    layer,
    selectedKey,
    setLayer,
    onPreviewDownPluginChange: setPreviewDownPluginId,
    onPreviewDownTargetChange: setPreviewDownTarget,
  });

  const entityEditors = useEntityEditors({ layout, layer });

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
      // Each layer keeps its own `<Display>` disposition — load it back
      // in now that we've switched to it.
      grid.loadFactoryLayout(value?.factory_layout ?? null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // The browser's own right-click context menu is never wanted anywhere
  // in the app — `<Composer>` already shows its own for a cell/division/
  // row/display in Layout mode, but this covers every other case too
  // (Mapping mode, the header, the Inspector panel, Settings…), where
  // nothing else calls `preventDefault()` on it.
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
  // <Display> exposes clickable key/drop targets of its own.

  // Autosaves `<Display>`'s disposition onto the current layer's own
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

      <Settings
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
            <Composer
              layoutSettings={layoutSettings}
              mode={mode}
              onModeChange={setMode}
              layout={layout}
              layer={layer}
              grid={grid}
              entityEditors={entityEditors}
              settingsOpened={settingsOpened}
            />
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
      {entityEditors.layoutEditorOpened && (
        <LayoutEditor
          editing={entityEditors.editingLayout}
          onClose={() => entityEditors.setLayoutEditorOpened(false)}
          onSaved={(id) => {
            entityEditors.setLayoutEditorOpened(false);
            void entityEditors.layoutMenuRef.current?.refresh(id);
          }}
        />
      )}
      {entityEditors.layerEditorOpened && layout && (
        <LayerEditor
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
