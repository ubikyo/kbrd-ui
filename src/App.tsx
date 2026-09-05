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
  MdMoreVert,
  MdSettings,
} from "react-icons/md";

import { useCallback, useEffect, useRef, useState } from "react";

import kbrdLogo from "./assets/media/KBRD.svg";

import Layout from "./components/Layout";
import type { LayoutMenuHandle } from "./components/Layout";
import LayoutEditorModal from "./components/LayoutEditorModal";
import { defaultGridCell, DEFAULT_LAYOUT_SETTINGS, MIN_UNIT } from "./types/layout";
import type {
  FactoryLayout,
  GridCell,
  LayoutData,
  LayoutSettings,
  MergeGroups,
} from "./types/layout";

import Factory from "./components/Factory";
import Inspector from "./components/Inspector";
import SettingsModal from "./components/SettingsModal";
import Layer from "./components/Layer";
import type { LayerMenuHandle } from "./components/Layer";
import LayerEditorModal from "./components/LayerEditorModal";
import { getBoard, updateBoard } from "./api/board";
import { deleteLayout } from "./api/layouts";
import { clearKey, deleteLayer, updateFactoryLayout } from "./api/layers";
import {
  addCellToRow,
  addMerge,
  canRemoveCell,
  gridRows,
  groupOf,
  insertCellAfter,
  maxItems,
  remainingUnitsInRow,
  removeCellFromRow,
  removeMerge,
  rowOf,
} from "./utils/layout";
import type {
  KeyPlugin,
  KeyProperty,
  LayerData,
} from "./types/layer";

// How long `<Factory>`'s grid sits idle before its disposition is
// autosaved onto the current layout — see the effect below.
const FACTORY_LAYOUT_AUTOSAVE_MS = 600;

// The Actions menu's own shortcuts are shown next to their label in
// whichever form this platform actually uses — ⌘ on macOS, Ctrl+
// elsewhere (both are accepted either way, see the keydown effect below).
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
  const [layoutSettings, setLayoutSettings] = useState<LayoutSettings>(
    DEFAULT_LAYOUT_SETTINGS,
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [layer, setLayer] = useState<LayerData | null>(null);

  const [settingsOpened, setSettingsOpened] = useState(false);

  // Which form the Inspector's plugin editors show — see `mode` on
  // `Inspector`'s props and each plugin's `LayoutEditor`/`MappingEditor`.
  const [mode, setMode] = useState<"layout" | "mapping">("layout");
  // `<Factory>`'s grid — kept here as plain state and autosaved onto the
  // current layer (see the effect below); see the comment on
  // `Factory` for why it's saved as one opaque blob rather than per-key.
  const [cells, setCells] = useState<Record<number, GridCell>>({});
  // Which cell ids populate each row — empty until a plugin is actually
  // dropped there; see `gridRows`.
  const [rowOverrides, setRowOverrides] = useState<Record<number, number[]>>(
    {},
  );
  const [mergeGroups, setMergeGroups] = useState<MergeGroups>([]);
  const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(
    null,
  );
  // A row's trailing empty space (or a fully empty row), selected instead
  // of a real cell — mutually exclusive with `selectedCellIndex`/
  // `boardSelected`, the same way those already are with each other. Lets
  // a copied plugin be pasted straight onto space nothing has claimed yet.
  const [selectedEmptyRow, setSelectedEmptyRow] = useState<number | null>(
    null,
  );
  // "Resize" in the Actions menu — while off, `Factory` hides every cell's
  // resize grip and dragging one to resize is impossible, not just harder
  // to reach.
  const [resizeEnabled, setResizeEnabled] = useState(false);
  // The physical screen (the white outline in `Factory`) selected as its
  // own target, mutually exclusive with a cell — see `selectBoard`/
  // `selectCell` below and the Actions menu it shows (Add/Edit/Delete
  // Layout/Layer).
  const [boardSelected, setBoardSelected] = useState(false);
  const layoutMenuRef = useRef<LayoutMenuHandle>(null);
  const layerMenuRef = useRef<LayerMenuHandle>(null);
  const [layoutEditorOpened, setLayoutEditorOpened] = useState(false);
  const [editingLayout, setEditingLayout] = useState<LayoutData | null>(null);
  const [layerEditorOpened, setLayerEditorOpened] = useState(false);
  const [editingLayer, setEditingLayer] = useState<LayerData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: "layout" | "layer";
    id: number;
    name: string;
  } | null>(null);
  // The cell "Merge" was invoked from, while waiting for a neighbour to
  // complete it — see the Notification/STOP below and `onStartMerge`.
  const [mergeSourceIndex, setMergeSourceIndex] = useState<number | null>(
    null,
  );
  // The last cell copied from the Actions menu (or Cmd/Ctrl+C) — "Paste"
  // is disabled until this is set, and applies its type/config/pluginIds
  // onto whichever cell is selected at the time.
  const [copiedCell, setCopiedCell] = useState<GridCell | null>(null);
  const [inspectorTab, setInspectorTab] = useState<string | null>("plugins");
  // TODO(preview-rebuild): only the setters are used until <Factory> reads
  // these back to force-render a key/plugin's down state, as <Preview> did.
  const [, setPreviewDownPluginId] = useState<number | null>(null);
  const [, setPreviewDownTarget] = useState<string | null>(null);
  const [keyOperation, setKeyOperation] = useState<{
    direction: "from" | "to" | "move";
    key: string;
  } | null>(null);
  const keyOperationRef = useRef<{
    direction: "from" | "to" | "move";
    key: string;
  } | null>(null);
  // Mirrors `layer` for the autosave effect below, so that effect only
  // has to depend on the grid state that actually triggers a save — not
  // on `layer` itself, which the save's own response also updates.
  const layerRef = useRef<LayerData | null>(null);
  // Mirrors `layout` so `changeLayout` can tell a genuine switch (a
  // different layout's id) from a same-layout refresh (the Layout editor's
  // `onSaved` re-fetching this same layout after an edit) — see there.
  const layoutRef = useRef<LayoutData | null>(null);
  // Sidesteps the autosave effect's very next run after `changeLayer`
  // seeds `cells`/`rowOverrides`/`mergeGroups` from a layer's own saved
  // `factory_layout` — that change is a load, not an edit to write back.
  const skipFactoryAutosaveRef = useRef(true);

  function stopKeyOperation() {
    keyOperationRef.current = null;
    setKeyOperation(null);
  }

  const changeLayout = useCallback((value: LayoutData | null) => {
    // The Layout editor's `onSaved` refreshes this same layout's own row
    // (e.g. a changed Max width/height, Caps size…) by re-fetching it, not
    // by switching to a different one — `Layout.refresh(id)` calls this
    // with a freshly-fetched object that still carries the same `id`. The
    // active layer and everything on the board must survive that; only an
    // actual switch (a different id, or none at all) should wipe them.
    const isSameLayout =
      layoutRef.current !== null &&
      value !== null &&
      layoutRef.current.id === value.id;
    setLayout(value);
    layoutRef.current = value;
    // Each layout keeps its own Caps size / Gap size — load them back in
    // now that we've switched to it, or reset to the reference panel once
    // there's no layout left to show them for. The physical screen's
    // width/height are *not* touched here — see the board-settings effect
    // below: they're the same for every layout, not per-layout.
    setLayoutSettings((current) => ({
      ...current,
      unitMm: value?.unit_mm ?? DEFAULT_LAYOUT_SETTINGS.unitMm,
      gapMm: value?.gap_mm ?? DEFAULT_LAYOUT_SETTINGS.gapMm,
    }));
    if (isSameLayout) return;
    setLayer(null);
    layerRef.current = null;
    setSelectedKey(null);
    keyOperationRef.current = null;
    setKeyOperation(null);
    setPreviewDownPluginId(null);
    setPreviewDownTarget(null);
    // The layer `<Layer>` activates next (see its effect) seeds
    // these back in via `changeLayer` — this is just the gap between
    // geometries.
    setCells({});
    setRowOverrides({});
    setMergeGroups([]);
    setSelectedCellIndex(null);
    setSelectedEmptyRow(null);
    setBoardSelected(false);
    setMergeSourceIndex(null);
    skipFactoryAutosaveRef.current = true;
  }, []);

  const changeLayer = useCallback((value: LayerData | null) => {
    setLayer(value);
    layerRef.current = value;
    setSelectedKey(null);
    keyOperationRef.current = null;
    setKeyOperation(null);
    setPreviewDownPluginId(null);
    setPreviewDownTarget(null);
    // Each layer keeps its own `<Factory>` disposition — load it back
    // in now that we've switched to it.
    setCells(value?.factory_layout?.cells ?? {});
    setRowOverrides(value?.factory_layout?.rowOverrides ?? {});
    setMergeGroups(value?.factory_layout?.mergeGroups ?? []);
    setSelectedCellIndex(null);
    setSelectedEmptyRow(null);
    setBoardSelected(false);
    setMergeSourceIndex(null);
    skipFactoryAutosaveRef.current = true;
  }, []);

  // The board (the physical screen) and a grid cell are mutually
  // exclusive selections — each shows its own Actions menu. While a merge
  // is in progress, a click that misses every cell (e.g. the background,
  // or an adjacent cell that turns out not to share an edge) must not
  // cancel it — only the STOP button or Escape does (see the Escape
  // effect near `stopMerge`).
  function selectBoard() {
    if (mergeSourceIndex !== null) return;
    setBoardSelected(true);
    setSelectedCellIndex(null);
    setSelectedEmptyRow(null);
  }

  function selectCell(index: number | null) {
    setSelectedCellIndex(index);
    setSelectedEmptyRow(null);
    setBoardSelected(false);
  }

  // A row's empty space, selected (instead of a cell) so a copied plugin
  // can be pasted straight onto it — see `emptySelection`/`pasteToEmptyRow`.
  function selectEmptyRow(row: number) {
    setSelectedEmptyRow(row);
    setSelectedCellIndex(null);
    setBoardSelected(false);
  }

  function openAddLayout() {
    setEditingLayout(null);
    setLayoutEditorOpened(true);
  }

  function openEditLayout() {
    if (!layout) return;
    setEditingLayout(layout);
    setLayoutEditorOpened(true);
  }

  function requestDeleteLayout() {
    if (!layout) return;
    setConfirmDelete({ kind: "layout", id: layout.id, name: layout.name });
  }

  function openAddLayer() {
    if (!layout) return;
    setEditingLayer(null);
    setLayerEditorOpened(true);
  }

  function openEditLayer() {
    if (!layer) return;
    setEditingLayer(layer);
    setLayerEditorOpened(true);
  }

  function requestDeleteLayer() {
    if (!layer) return;
    setConfirmDelete({ kind: "layer", id: layer.id, name: layer.name });
  }

  async function confirmDeleteNow() {
    if (!confirmDelete) return;
    if (confirmDelete.kind === "layout") {
      await deleteLayout(confirmDelete.id);
      setConfirmDelete(null);
      await layoutMenuRef.current?.refresh();
    } else {
      await deleteLayer(confirmDelete.id);
      setConfirmDelete(null);
      await layerMenuRef.current?.refresh();
    }
  }

  // The physical screen's width/height (`board`, see KBRD-API) — one row
  // for the whole device, loaded once here rather than re-seeded on every
  // `changeLayout` the way Caps size / Gap size are: switching layouts
  // must never resize the physical screen out from under the board.
  useEffect(() => {
    let cancelled = false;
    void getBoard().then((data) => {
      if (cancelled) return;
      setLayoutSettings((current) => ({
        ...current,
        physicalWidthMm: data.physical_width_mm,
        physicalHeightMm: data.physical_height_mm,
      }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveBoardSettings(settings: LayoutSettings) {
    setLayoutSettings(settings);
    const updated = await updateBoard({
      physical_width_mm: settings.physicalWidthMm,
      physical_height_mm: settings.physicalHeightMm,
    });
    setLayoutSettings((current) => ({
      ...current,
      physicalWidthMm: updated.physical_width_mm,
      physicalHeightMm: updated.physical_height_mm,
    }));
  }

  function changePlugins(plugins: KeyPlugin[]) {
    setLayer((value) => (value ? { ...value, plugins } : null));
  }

  function changeKeyProperties(keyProperties: KeyProperty[]) {
    setLayer((value) =>
      value ? { ...value, key_properties: keyProperties } : null,
    );
  }

  // TODO(preview-rebuild): dropping a plugin onto a key and completing a
  // duplicate/move operation both used to happen by clicking a key in
  // <Preview>. Restore that wiring (see git history / Preview.tsx) once
  // <Factory> exposes clickable key/drop targets of its own.

  function startDuplicateFrom() {
    if (!selectedKey) return;
    const operation = { direction: "from" as const, key: selectedKey };
    keyOperationRef.current = operation;
    setKeyOperation(operation);
  }

  function startDuplicateTo() {
    if (!selectedKey) return;
    const operation = { direction: "to" as const, key: selectedKey };
    keyOperationRef.current = operation;
    setKeyOperation(operation);
  }

  function startMoveTo() {
    if (!selectedKey) return;
    const operation = { direction: "move" as const, key: selectedKey };
    keyOperationRef.current = operation;
    setKeyOperation(operation);
  }

  async function clearSelectedKey() {
    if (!layer || !selectedKey) return;
    const value = await clearKey(layer.id, selectedKey);
    setLayer(value);
    setPreviewDownPluginId(null);
    setPreviewDownTarget(null);
  }

  function changeCell(index: number, patch: Partial<GridCell>) {
    setCells((current) => ({
      ...current,
      [index]: { ...(current[index] ?? defaultGridCell()), ...patch },
    }));
  }

  function startMerge() {
    if (selectedCellIndex === null) return;
    setMergeSourceIndex(selectedCellIndex);
  }

  function stopMerge() {
    setMergeSourceIndex(null);
  }

  // Merge only ever stops two ways: the notification's own STOP button, or
  // Escape — no click-away, no closing the notification some other way.
  useEffect(() => {
    if (mergeSourceIndex === null) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") stopMerge();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mergeSourceIndex]);

  // Tab toggles Resize — a global shortcut, independent of mode/selection —
  // except while a modal has its own fields to tab through normally, or
  // while typing in a text field, where Tab must keep doing its normal job.
  useEffect(() => {
    if (settingsOpened || layoutEditorOpened || layerEditorOpened || confirmDelete) {
      return;
    }
    function handleTab(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setResizeEnabled((current) => !current);
    }
    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [settingsOpened, layoutEditorOpened, layerEditorOpened, confirmDelete]);

  function mergeWith(target: number) {
    if (mergeSourceIndex === null) return;
    const newPrimary = Math.min(
      ...groupOf(mergeSourceIndex, mergeGroups),
      ...groupOf(target, mergeGroups),
    );
    setMergeGroups((current) => addMerge(current, mergeSourceIndex, target));
    setSelectedCellIndex(newPrimary);
    // Merging one cell in doesn't end merge mode — it keeps going, now
    // from the grown group, so the next adjacent cell clicked keeps
    // merging into it. Only STOP/Escape (`stopMerge`) ends it.
    setMergeSourceIndex(newPrimary);
  }

  // Growing a merge into `row`'s still-empty space instead of an existing
  // cell — `Factory` has already checked it's actually adjacent to the
  // merge's group before calling this. The new cell is a plain,
  // plugin-less `defaultGridCell`: it never renders or is edited on its
  // own once merged (only the group's primary is — see `primaryOf`), so it
  // needs no `typeId` of its own, unlike one created by dropping a plugin.
  function mergeWithEmpty(row: number) {
    if (mergeSourceIndex === null) return;
    const remaining = remainingUnitsInRow(
      row,
      rows,
      cells,
      layoutSettings.physicalWidthMm,
      layoutSettings.unitMm,
      layoutSettings.gapMm,
    );
    if (remaining < MIN_UNIT) return;
    const { rows: updatedRows, id } = addCellToRow(rows, row);
    const newPrimary = Math.min(...groupOf(mergeSourceIndex, mergeGroups), id);
    setRowOverrides((current) => ({ ...current, [row]: updatedRows[row] }));
    setCells((current) => ({
      ...current,
      [id]: defaultGridCell(Math.min(1, remaining)),
    }));
    setMergeGroups((current) => addMerge(current, mergeSourceIndex, id));
    setSelectedCellIndex(newPrimary);
    // Same continuation as `mergeWith` — merging doesn't end merge mode.
    setMergeSourceIndex(newPrimary);
  }

  function unmerge() {
    if (selectedCellIndex === null) return;
    setMergeGroups((current) => removeMerge(current, selectedCellIndex));
  }

  // Copy a cell's type, config and Mapping plugins — not its own id or
  // position. Cloned so a later Paste's own further edits can't reach
  // back into this cell's arrays/objects.
  function copySelectedCell() {
    if (!layoutSelection) return;
    const { typeId, typeConfig, pluginIds, unit } = layoutSelection.cell;
    setCopiedCell({ typeId, typeConfig: { ...typeConfig }, pluginIds: [...pluginIds], unit });
  }

  // Autosaves `<Factory>`'s disposition onto the current layer's own
  // `factory_layout` — debounced so a drag-resize or a run of clicks
  // doesn't fire one PUT per change. Skipped for the run right after
  // `changeLayer` seeds this same state from what's already saved (see
  // `skipFactoryAutosaveRef`), and reads `layerRef` rather than
  // `layer` so this save's own response (a fresh `setLayer`)
  // doesn't re-trigger itself.
  useEffect(() => {
    const current = layerRef.current;
    if (!current) return;
    if (skipFactoryAutosaveRef.current) {
      skipFactoryAutosaveRef.current = false;
      return;
    }
    const factoryLayout: FactoryLayout = { rowOverrides, cells, mergeGroups };
    const timeout = setTimeout(() => {
      void updateFactoryLayout(current.id, factoryLayout).then((updated) => {
        setLayer(updated);
        layerRef.current = updated;
      });
    }, FACTORY_LAYOUT_AUTOSAVE_MS);
    return () => clearTimeout(timeout);
  }, [cells, rowOverrides, mergeGroups]);

  const computedGridItemsY = maxItems(
    layoutSettings.physicalHeightMm,
    layoutSettings.unitMm,
    layoutSettings.gapMm,
  );
  // The current layout's own Max height (1U) override — see the Layout
  // editor's Geometry tab — clamped to what actually still fits in case
  // Caps size/Gap size/the board's own size changed since it was set.
  const gridItemsY =
    layout?.max_rows != null
      ? Math.min(layout.max_rows, computedGridItemsY)
      : computedGridItemsY;
  // The board's full grid — see `gridRows`: a row starts with no cells at
  // all, and only gets any once a plugin is dropped on it.
  const rows = gridRows(gridItemsY, rowOverrides);

  // Drops a freshly-typed cell onto the end of `row`'s empty space — see
  // `Factory`'s trailing drop target. Generates the new cell's id and
  // selects it in the same stroke.
  function createCell(row: number, cell: GridCell) {
    const { rows: updatedRows, id } = addCellToRow(rows, row);
    setRowOverrides((current) => ({ ...current, [row]: updatedRows[row] }));
    setCells((current) => ({ ...current, [id]: cell }));
    setSelectedCellIndex(id);
    setSelectedEmptyRow(null);
  }

  // Removes `index` from its row entirely — "Remove cell" in the Actions
  // menu. No-ops (see `canRemoveCell`) rather than pulling a member out
  // from under a merge; unlike a cell's Unit, a row's cell count has no
  // floor, so this can empty a row back out.
  function removeCell(index: number) {
    const row = rowOf(index, rows);
    if (row === -1 || !canRemoveCell(index, rows, mergeGroups)) return;
    setRowOverrides((current) => ({
      ...current,
      [row]: removeCellFromRow(rows, row, index)[row],
    }));
    setCells((current) => {
      const rest = { ...current };
      delete rest[index];
      return rest;
    });
    setSelectedCellIndex((current) => (current === index ? null : current));
  }

  const selectedCell =
    selectedCellIndex !== null ? cells[selectedCellIndex] : undefined;
  const layoutSelection =
    selectedCellIndex !== null && selectedCell
      ? {
          index: selectedCellIndex,
          cell: selectedCell,
          isMerged: groupOf(selectedCellIndex, mergeGroups).length > 1,
          canRemove: canRemoveCell(selectedCellIndex, rows, mergeGroups),
          // Whether the copied cell (if any) still fits in this row's
          // Unit budget, next to the selected cell — see
          // `pasteToSelectedCell`.
          canPaste:
            copiedCell !== null &&
            copiedCell.unit <=
              remainingUnitsInRow(
                rowOf(selectedCellIndex, rows),
                rows,
                cells,
                layoutSettings.physicalWidthMm,
                layoutSettings.unitMm,
                layoutSettings.gapMm,
              ),
        }
      : null;

  // Pastes the copied cell into the row right after the selected one —
  // not onto it (see `insertCellAfter`) — as long as there's still room
  // for it (`layoutSelection.canPaste`).
  function pasteToSelectedCell() {
    if (!layoutSelection || !copiedCell || !layoutSelection.canPaste) return;
    const row = rowOf(layoutSelection.index, rows);
    if (row === -1) return;
    const { rows: updatedRows, id } = insertCellAfter(
      rows,
      row,
      layoutSelection.index,
    );
    setRowOverrides((current) => ({ ...current, [row]: updatedRows[row] }));
    setCells((current) => ({
      ...current,
      [id]: {
        typeId: copiedCell.typeId,
        typeConfig: { ...copiedCell.typeConfig },
        pluginIds: [...copiedCell.pluginIds],
        unit: copiedCell.unit,
      },
    }));
    setSelectedCellIndex(id);
  }

  const emptySelection =
    selectedEmptyRow !== null
      ? {
          row: selectedEmptyRow,
          // Same budget check as `layoutSelection.canPaste`, against
          // whatever's left of this row instead of next to a selected cell.
          canPaste:
            copiedCell !== null &&
            copiedCell.unit <=
              remainingUnitsInRow(
                selectedEmptyRow,
                rows,
                cells,
                layoutSettings.physicalWidthMm,
                layoutSettings.unitMm,
                layoutSettings.gapMm,
              ),
        }
      : null;

  // Pastes the copied cell straight into the selected empty row/space —
  // the same fresh-cell creation `createCell` does for a plugin dropped
  // there, just fed from the clipboard instead of a drag.
  function pasteToEmptyRow() {
    if (!emptySelection || !copiedCell || !emptySelection.canPaste) return;
    const { rows: updatedRows, id } = addCellToRow(rows, emptySelection.row);
    setRowOverrides((current) => ({
      ...current,
      [emptySelection.row]: updatedRows[emptySelection.row],
    }));
    setCells((current) => ({
      ...current,
      [id]: {
        typeId: copiedCell.typeId,
        typeConfig: { ...copiedCell.typeConfig },
        pluginIds: [...copiedCell.pluginIds],
        unit: copiedCell.unit,
      },
    }));
    setSelectedCellIndex(id);
    setSelectedEmptyRow(null);
  }

  // The Actions menu's own shortcuts, all Layout-mode-only and all no-ops
  // while the user is actually typing into a text field somewhere else (a
  // plugin's config, a name field…) rather than working the board:
  // Backspace deletes the selected cell ("Delete"), Cmd/Ctrl+C copies it,
  // Cmd/Ctrl+V pastes next to it. Read through a ref (rather than listed
  // as effect deps) so the listener is attached once, not re-subscribed
  // on every render.
  const layoutShortcutsRef = useRef({
    mode,
    layoutSelection,
    emptySelection,
    removeCell,
    copySelectedCell,
    pasteToSelectedCell,
    pasteToEmptyRow,
  });
  useEffect(() => {
    layoutShortcutsRef.current = {
      mode,
      layoutSelection,
      emptySelection,
      removeCell,
      copySelectedCell,
      pasteToSelectedCell,
      pasteToEmptyRow,
    };
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const {
        mode,
        layoutSelection,
        emptySelection,
        removeCell,
        copySelectedCell,
        pasteToSelectedCell,
        pasteToEmptyRow,
      } = layoutShortcutsRef.current;
      if (mode !== "layout" || (!layoutSelection && !emptySelection)) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const withModifier = event.metaKey || event.ctrlKey;
      if (layoutSelection?.canRemove && event.key === "Backspace") {
        event.preventDefault();
        removeCell(layoutSelection.index);
      } else if (layoutSelection && withModifier && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelectedCell();
      } else if (withModifier && event.key.toLowerCase() === "v") {
        if (layoutSelection?.canPaste) {
          event.preventDefault();
          pasteToSelectedCell();
        } else if (emptySelection?.canPaste) {
          event.preventDefault();
          pasteToEmptyRow();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

          <Layout ref={layoutMenuRef} onChange={changeLayout} onAdd={openAddLayout} />
          {layout && (
            <Layer
              key={layout.id}
              ref={layerMenuRef}
              geometryId={layout.id}
              onChange={changeLayer}
              onAdd={openAddLayer}
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
        onSave={saveBoardSettings}
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
                rows={rows}
                cells={cells}
                onCellsChange={setCells}
                onCreateCell={createCell}
                mergeGroups={mergeGroups}
                selectedCellIndex={selectedCellIndex}
                onSelectCell={selectCell}
                mergeSourceIndex={mergeSourceIndex}
                onMergeWith={mergeWith}
                selectedEmptyRow={selectedEmptyRow}
                onSelectEmpty={selectEmptyRow}
                onMergeWithEmpty={mergeWithEmpty}
                isBoardSelected={boardSelected}
                onSelectBoard={selectBoard}
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

              {/* Moved out of the board's own Actions menu — resizing is a
                  view option, not a per-layout action, so it lives here as
                  a persistent switch, aligned right at the same level as
                  the Layout/Mapping switch on the left. Also toggled by
                  Tab (see the keydown effect near `stopMerge`). */}
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

              {/* Moved out of Properties (was `LayoutCellProperties`) so
                  it's reachable regardless of which Inspector tab is open
                  — only meaningful in Layout mode, and only once a cell is
                  selected for it to act on. */}
              {mode === "layout" && layoutSelection && (
                <Menu
                  position="bottom-end"
                  width={200}
                  styles={{ item: { padding: "4px var(--mantine-spacing-sm)" } }}
                >
                  <Menu.Target>
                    <Button
                      variant="subtle"
                      color="gray"
                      size="xs"
                      leftSection={<MdMoreVert />}
                      style={{
                        position: "absolute",
                        top: 20,
                        right: 20,
                        zIndex: 20,
                      }}
                    >
                      Actions
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<MdCallMerge />} onClick={startMerge}>
                      Merge
                    </Menu.Item>
                    {layoutSelection.isMerged && (
                      <Menu.Item leftSection={<MdCallSplit />} onClick={unmerge}>
                        Unmerge
                      </Menu.Item>
                    )}
                    <Menu.Divider />
                    <Menu.Item
                      leftSection={<MdContentCopy />}
                      rightSection={<ShortcutHint>{MOD_KEY_LABEL}C</ShortcutHint>}
                      onClick={copySelectedCell}
                    >
                      Copy
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<MdContentPaste />}
                      rightSection={<ShortcutHint>{MOD_KEY_LABEL}V</ShortcutHint>}
                      disabled={!layoutSelection.canPaste}
                      onClick={pasteToSelectedCell}
                    >
                      Paste
                    </Menu.Item>
                    {layoutSelection.canRemove && (
                      <>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          leftSection={<MdDelete />}
                          rightSection={<ShortcutHint>⌫</ShortcutHint>}
                          onClick={() => removeCell(layoutSelection.index)}
                        >
                          Delete
                        </Menu.Item>
                      </>
                    )}
                  </Menu.Dropdown>
                </Menu>
              )}

              {/* A row's empty space selected instead of a cell (see
                  `selectEmptyRow`) — nothing to Merge/Copy/Delete yet, just
                  somewhere a copied plugin can be pasted straight onto. */}
              {mode === "layout" && emptySelection && (
                <Menu
                  position="bottom-end"
                  width={200}
                  styles={{ item: { padding: "4px var(--mantine-spacing-sm)" } }}
                >
                  <Menu.Target>
                    <Button
                      variant="subtle"
                      color="gray"
                      size="xs"
                      leftSection={<MdMoreVert />}
                      style={{
                        position: "absolute",
                        top: 20,
                        right: 20,
                        zIndex: 20,
                      }}
                    >
                      Actions
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<MdContentPaste />}
                      rightSection={<ShortcutHint>{MOD_KEY_LABEL}V</ShortcutHint>}
                      disabled={!emptySelection.canPaste}
                      onClick={pasteToEmptyRow}
                    >
                      Paste
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}

              {/* The physical screen itself, selected as its own target —
                  see `selectBoard` — for the Layout/Layer CRUD that used
                  to live in their own header dropdowns. */}
              {boardSelected && (
                <Menu
                  position="bottom-end"
                  width={200}
                  styles={{ item: { padding: "4px var(--mantine-spacing-sm)" } }}
                >
                  <Menu.Target>
                    <Button
                      variant="subtle"
                      color="gray"
                      size="xs"
                      leftSection={<MdMoreVert />}
                      style={{
                        position: "absolute",
                        top: 20,
                        right: 20,
                        zIndex: 20,
                      }}
                    >
                      Actions
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Layout</Menu.Label>
                    <Menu.Item leftSection={<MdAdd />} onClick={openAddLayout}>
                      Add
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<MdEdit />}
                      disabled={!layout}
                      onClick={openEditLayout}
                    >
                      Edit
                    </Menu.Item>
                    <Menu.Item
                      color="red"
                      leftSection={<MdDelete />}
                      disabled={!layout}
                      onClick={requestDeleteLayout}
                    >
                      Delete
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Label>Layer</Menu.Label>
                    <Menu.Item
                      leftSection={<MdAdd />}
                      disabled={!layout}
                      onClick={openAddLayer}
                    >
                      Add
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<MdEdit />}
                      disabled={!layer}
                      onClick={openEditLayer}
                    >
                      Edit
                    </Menu.Item>
                    <Menu.Item
                      color="red"
                      leftSection={<MdDelete />}
                      disabled={!layer}
                      onClick={requestDeleteLayer}
                    >
                      Delete
                    </Menu.Item>
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
              layoutSelection={layoutSelection}
              onLayoutCellChange={changeCell}
              tab={inspectorTab}
              onTabChange={setInspectorTab}
              onChange={changePlugins}
              onKeyPropertiesChange={changeKeyProperties}
              onPreviewDownPluginChange={setPreviewDownPluginId}
              onPreviewDownTargetChange={setPreviewDownTarget}
              onDuplicateFrom={startDuplicateFrom}
              onDuplicateTo={startDuplicateTo}
              onMoveTo={startMoveTo}
              onClearAll={clearSelectedKey}
            />
          </Splitter.Pane>
        </Splitter>
      </AppShell.Main>
      {keyOperation && (
        <Notification
          icon={
            keyOperation.direction === "move" ? (
              <MdDriveFileMove size={18} />
            ) : (
              <MdContentCopy size={18} />
            )
          }
          title={
            keyOperation.direction === "from"
              ? "Duplicate from"
              : keyOperation.direction === "to"
                ? "Duplicate to"
                : "Move to"
          }
          onClose={stopKeyOperation}
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
              {keyOperation.direction === "from"
                ? "Click the source key to duplicate."
                : keyOperation.direction === "to"
                  ? "Click each destination key to duplicate."
                  : "Click the destination key to move."}
            </Text>
            <Button size="compact-xs" color="red" onClick={stopKeyOperation}>
              STOP
            </Button>
          </Group>
        </Notification>
      )}
      {mergeSourceIndex !== null && (
        <Notification
          icon={<MdCallMerge size={18} />}
          title="Merge"
          withCloseButton={false}
          withBorder
          style={{
            position: "fixed",
            left: 20,
            bottom: 20,
            zIndex: 1000,
          }}
        >
          <Group gap="md" wrap="nowrap">
            <Text size="sm">Click an adjacent cell to merge with it.</Text>
            <Button size="compact-xs" color="red" onClick={stopMerge}>
              STOP
            </Button>
          </Group>
        </Notification>
      )}
      {layoutEditorOpened && (
        <LayoutEditorModal
          editing={editingLayout}
          onClose={() => setLayoutEditorOpened(false)}
          onSaved={(id) => {
            setLayoutEditorOpened(false);
            void layoutMenuRef.current?.refresh(id);
          }}
        />
      )}
      {layerEditorOpened && layout && (
        <LayerEditorModal
          geometryId={layout.id}
          editing={editingLayer}
          onClose={() => setLayerEditorOpened(false)}
          onSaved={(id) => {
            setLayerEditorOpened(false);
            void layerMenuRef.current?.refresh(id);
          }}
        />
      )}
      {confirmDelete && (
        <Modal
          opened
          onClose={() => setConfirmDelete(null)}
          title={
            <Text fw={700}>
              Delete {confirmDelete.kind === "layout" ? "layout" : "layer"}
            </Text>
          }
          centered
          size="sm"
        >
          <Stack>
            <Text>
              Delete {confirmDelete.kind === "layout" ? "layout" : "layer"}{" "}
              <Text component="span" fw={600}>
                {confirmDelete.name}
              </Text>
              ?
            </Text>
            <Text size="sm" c="dimmed">
              This action cannot be undone.
            </Text>
            <Group justify="flex-end">
              <Button color="gray" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                color="red"
                leftSection={<MdDelete size={16} />}
                onClick={() => void confirmDeleteNow()}
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
