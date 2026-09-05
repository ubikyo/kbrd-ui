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
import type { LayoutMenuHandle } from "./components/Layout";
import LayoutEditorModal from "./components/modals/LayoutEditorModal";
import DivideModal from "./components/modals/DivideModal";
import {
  createDivideGrid,
  defaultDivisionCell,
  defaultGridCell,
  DEFAULT_LAYOUT_SETTINGS,
} from "./types/layout";
import type {
  DivisionCell,
  FactoryLayout,
  GridCell,
  LayoutData,
  LayoutSettings,
  MergeGroups,
} from "./types/layout";

import Factory from "./components/Factory";
import type { ContextMenuTarget } from "./components/Factory";
import Inspector from "./components/Inspector";
import SettingsModal from "./components/modals/SettingsModal";
import Layer from "./components/Layer";
import type { LayerMenuHandle } from "./components/Layer";
import LayerEditorModal from "./components/modals/LayerEditorModal";
import { getDisplay, updateDisplay } from "./api/display";
import { deleteLayout } from "./api/layouts";
import { clearKey, deleteLayer, updateFactoryLayout } from "./api/layers";
import {
  addCellToRow,
  addMerge,
  canRemoveCell,
  cellRect,
  cellsAreContiguous,
  divisionsAreContiguous,
  gridRows,
  groupOf,
  maxItems,
  maxUnitForCell,
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

// How many past `FactoryLayout` snapshots Cmd/Ctrl+Z can step back
// through — see `undoStackRef`. Capped so a long editing session's own
// history doesn't grow unbounded.
const MAX_UNDO_HISTORY = 100;

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
  // Every currently-selected top-level cell's own primary id — a plain
  // click replaces this with a singleton (or clears it, toggling the
  // sole member off); Cmd/Ctrl+click toggles one id in or out instead
  // (see `selectCell`/`toggleCellSelection`). What the context menu
  // offers depends on how many are selected and whether they're all
  // mutually adjacent — see `isCellSelectionContiguous` below.
  const [selectedCellIndices, setSelectedCellIndices] = useState<number[]>([]);
  // A row's trailing empty space (or a fully empty row), selected instead
  // of a real cell — mutually exclusive with `selectedCellIndices`/
  // `displaySelected`, the same way those already are with each other. Lets
  // a copied plugin be pasted straight onto space nothing has claimed yet.
  const [selectedEmptyRow, setSelectedEmptyRow] = useState<number | null>(
    null,
  );
  // "Resize" in the Actions menu — while off, `Factory` hides every cell's
  // resize grip and dragging one to resize is impossible, not just harder
  // to reach.
  const [resizeEnabled, setResizeEnabled] = useState(false);
  // The physical screen (the white outline in `Factory`) selected as its
  // own target, mutually exclusive with a cell — see `selectDisplay`/
  // `selectCell` below and the Actions menu it shows (Add/Edit/Delete
  // Layout/Layer).
  const [displaySelected, setDisplaySelected] = useState(false);
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
  // Which divisions of `selectedCellIndices`' sole cell (once divided —
  // see `GridCell.divide`) are the real focus, instead of the cell as a
  // whole — meaningless unless exactly one cell is selected and it's
  // divided; set only via `selectDivision`/`toggleDivisionSelection`, and
  // cleared by every other selection helper below so it never survives
  // selecting something else. Same plain-click-replaces /
  // Cmd-click-toggles rule, and the same contiguity check
  // (`isDivisionSelectionContiguous`), just scoped to this one cell's own
  // divisions instead of the display's top-level cells.
  const [selectedDivisionIndices, setSelectedDivisionIndices] = useState<
    number[]
  >([]);
  const [divideModalOpened, setDivideModalOpened] = useState(false);
  // The display's own right-click context menu — replaces the old floating
  // "Actions" button. `Factory` reports where the cursor was and what it
  // landed on (already selected the same way a left click would by the
  // time this fires); only the position and which content to show
  // (`kind`) need to live here, since the selection state it reads
  // (`layoutSelection`/`divisionSelection`/`emptySelection`/
  // `displaySelected`) is already the source of truth for *which* cell,
  // division, row or the display itself is the real target.
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    kind: ContextMenuTarget["kind"];
  } | null>(null);
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
  // Cmd/Ctrl+Z's own undo history — every past `FactoryLayout` (before
  // whatever change just landed), pushed by the effect right below the
  // autosave one, which shares its own "was this just a layer load, not
  // a real edit" flag (`skipFactoryAutosaveRef`) so switching layer/layout
  // doesn't get recorded as an undo step. `previousFactoryLayoutRef` is
  // that effect's own memory of the last state it saw, so it always
  // pushes the state a change is *leaving*, not the one it's arriving
  // at. `isUndoingRef` marks a change `undo` itself just made, so that
  // pass doesn't turn around and push the very state undo just popped
  // back onto the stack.
  const undoStackRef = useRef<FactoryLayout[]>([]);
  const previousFactoryLayoutRef = useRef<FactoryLayout | null>(null);
  const isUndoingRef = useRef(false);

  function stopKeyOperation() {
    keyOperationRef.current = null;
    setKeyOperation(null);
  }

  const changeLayout = useCallback((value: LayoutData | null) => {
    // The Layout editor's `onSaved` refreshes this same layout's own row
    // (e.g. a changed Max width/height, Caps size…) by re-fetching it, not
    // by switching to a different one — `Layout.refresh(id)` calls this
    // with a freshly-fetched object that still carries the same `id`. The
    // active layer and everything on the display must survive that; only an
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
    // width/height are *not* touched here — see the display-settings effect
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
    setSelectedCellIndices([]);
    setSelectedDivisionIndices([]);
    setSelectedEmptyRow(null);
    setDisplaySelected(false);
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
    setSelectedCellIndices([]);
    setSelectedDivisionIndices([]);
    setSelectedEmptyRow(null);
    setDisplaySelected(false);
    skipFactoryAutosaveRef.current = true;
  }, []);

  // The display (the physical screen) and a grid cell are mutually
  // exclusive selections — each shows its own context menu.
  function selectDisplay() {
    setDisplaySelected(true);
    setSelectedCellIndices([]);
    setSelectedDivisionIndices([]);
    setSelectedEmptyRow(null);
  }

  // A plain click on a cell — replaces the whole selection with just
  // this one, or clears it if this was already the sole selection (a
  // toggle-off, same as before multi-select existed). Cmd/Ctrl+click
  // (`toggleCellSelection`) is the only way to select more than one.
  function selectCell(index: number | null) {
    setSelectedCellIndices((current) =>
      index === null ? [] : current.length === 1 && current[0] === index ? [] : [index],
    );
    setSelectedDivisionIndices([]);
    setSelectedEmptyRow(null);
    setDisplaySelected(false);
  }

  // Cmd/Ctrl+click on a cell — toggles `index` in or out of the current
  // multi-selection, unless the previous selection was of a different
  // kind entirely (a division, empty space, the display), in which case it
  // just starts a fresh one-cell selection instead, the same as a plain
  // click would.
  function toggleCellSelection(index: number) {
    const inCellSelectionMode =
      !displaySelected && selectedEmptyRow === null && selectedDivisionIndices.length === 0;
    setSelectedCellIndices((current) => {
      if (!inCellSelectionMode) return [index];
      return current.includes(index)
        ? current.filter((id) => id !== index)
        : [...current, index];
    });
    setSelectedDivisionIndices([]);
    setSelectedEmptyRow(null);
    setDisplaySelected(false);
  }

  // A division of `parentId`'s own divided cell — see `GridCell.divide`
  // — selected instead of the divided cell as a whole; mutually exclusive
  // with every other selection, same as `selectCell`. A plain click on a
  // division always focuses its parent as the sole cell selection (there
  // being no sense in which the parent, as a whole, is "also" selected
  // once you're looking at one specific division of it).
  function selectDivision(ref: { parentId: number; subId: number }) {
    setSelectedCellIndices([ref.parentId]);
    setSelectedDivisionIndices((current) =>
      current.length === 1 && current[0] === ref.subId ? [] : [ref.subId],
    );
    setSelectedEmptyRow(null);
    setDisplaySelected(false);
  }

  // Cmd/Ctrl+click on a division — toggles `ref.subId` in or out of the
  // current division multi-selection, as long as it's still the same
  // parent already focused; a different parent (or no division focus at
  // all yet) just starts fresh, same as a plain click would.
  function toggleDivisionSelection(ref: { parentId: number; subId: number }) {
    const sameParentFocused =
      selectedCellIndices.length === 1 && selectedCellIndices[0] === ref.parentId;
    setSelectedCellIndices([ref.parentId]);
    setSelectedDivisionIndices((current) => {
      if (!sameParentFocused) return [ref.subId];
      return current.includes(ref.subId)
        ? current.filter((id) => id !== ref.subId)
        : [...current, ref.subId];
    });
    setSelectedEmptyRow(null);
    setDisplaySelected(false);
  }

  // A row's empty space, selected (instead of a cell) so a copied plugin
  // can be pasted straight onto it — see `emptySelection`/`pasteToEmptyRow`.
  function selectEmptyRow(row: number) {
    setSelectedEmptyRow(row);
    setSelectedCellIndices([]);
    setSelectedDivisionIndices([]);
    setDisplaySelected(false);
  }

  // `Factory`'s `onContextMenu` — a right-click anywhere on the display.
  // `Factory` has already made whatever selection this right-click
  // implies by the time this fires (preserving a multi-selection the
  // clicked cell/division was already part of, rather than always
  // collapsing it to just that one — see its own context-menu handlers),
  // so this only needs to open the menu itself, at the click.
  function handleContextMenu(x: number, y: number, target: ContextMenuTarget) {
    setContextMenu({ x, y, kind: target.kind });
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

  // The physical screen's width/height (`display`, see KBRD-API) — one row
  // for the whole device, loaded once here rather than re-seeded on every
  // `changeLayout` the way Caps size / Gap size are: switching layouts
  // must never resize the physical screen out from under the display.
  useEffect(() => {
    let cancelled = false;
    void getDisplay().then((data) => {
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

  async function saveDisplaySettings(settings: LayoutSettings) {
    setLayoutSettings(settings);
    const updated = await updateDisplay({
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

  // Same idea as `changeCell`, for one division of a divided cell (see
  // `GridCell.divide`) instead of a top-level one.
  function changeDivisionCell(
    parentId: number,
    subId: number,
    patch: Partial<DivisionCell>,
  ) {
    setCells((current) => {
      const parent = current[parentId];
      if (!parent?.divide) return current;
      const existing = parent.divide.cells[subId] ?? defaultDivisionCell();
      return {
        ...current,
        [parentId]: {
          ...parent,
          divide: {
            ...parent.divide,
            cells: { ...parent.divide.cells, [subId]: { ...existing, ...patch } },
          },
        },
      };
    });
  }

  // "Merge" on multiple selected, mutually-contiguous top-level cells —
  // folds them all into one `mergeGroups` entry in one stroke instead of
  // growing a merge one adjacent click at a time (the old
  // notification/STOP-driven flow this replaces — see
  // `isCellSelectionContiguous`, which gates whether the menu even offers
  // this).
  function mergeSelectedCells() {
    if (!isCellSelectionContiguous) return;
    const [first, ...rest] = selectedCellIndices;
    setMergeGroups((current) => rest.reduce((groups, id) => addMerge(groups, first, id), current));
    setSelectedCellIndices([Math.min(...selectedCellIndices)]);
  }

  function unmerge() {
    if (selectedCellIndices.length !== 1) return;
    setMergeGroups((current) => removeMerge(current, selectedCellIndices[0]));
  }

  // "Delete" on however many top-level cells are currently selected
  // (contiguous or not) — removes every one that's actually removable
  // (`canRemoveCell`) in a single pass. Deliberately not a loop of
  // `removeCell` calls: that function reads `rows` from this render's own
  // closure rather than a functional update, so calling it more than once
  // in the same stroke would have each call overwrite the last's result
  // instead of compounding.
  function deleteSelectedCells() {
    const removable = new Set(
      selectedCellIndices.filter((id) => canRemoveCell(id, rows, mergeGroups)),
    );
    if (removable.size === 0) return;
    setRowOverrides((current) => {
      const next = { ...current };
      rows.forEach((cellIds, row) => {
        if (cellIds.some((id) => removable.has(id))) {
          next[row] = cellIds.filter((id) => !removable.has(id));
        }
      });
      return next;
    });
    setCells((current) => {
      const rest = { ...current };
      for (const id of removable) delete rest[id];
      return rest;
    });
    setSelectedCellIndices([]);
  }

  // Same idea as `mergeSelectedCells`, scoped to one cell's own divisions
  // (`divide.mergeGroups`) instead of the display's top-level `mergeGroups`.
  function mergeSelectedDivisions() {
    if (selectedCellIndices.length !== 1 || !isDivisionSelectionContiguous) return;
    const parentId = selectedCellIndices[0];
    const parent = cells[parentId];
    if (!parent?.divide) return;

    const [first, ...rest] = selectedDivisionIndices;
    const mergeGroups = rest.reduce(
      (groups, id) => addMerge(groups, first, id),
      parent.divide.mergeGroups,
    );
    const group = groupOf(first, mergeGroups);
    const primary = Math.min(...group);
    // The merged shape only ever renders/edits its primary's own
    // `DivisionCell` — divisions start blank (unlike a top-level cell,
    // always typed the moment it exists), so if whichever one already
    // has a plugin on it isn't the new primary, carry it over rather
    // than letting it silently vanish from view behind a blank one.
    const divisionCells = { ...parent.divide.cells };
    if (!divisionCells[primary]?.typeId) {
      const withContent = group.find((id) => divisionCells[id]?.typeId);
      if (withContent !== undefined) divisionCells[primary] = divisionCells[withContent];
    }

    // Every division just ended up in one group — there's nothing left
    // to divide into more than one piece, so this collapses back to the
    // plain, undivided cell it would be if Divide had never happened,
    // carrying over whatever content survived the merge above. If
    // nothing did (every division was blank), that plain cell would
    // itself be blank — rather than leave that sitting in the row, drop
    // it entirely, the same as merging two blank top-level cells would
    // have nothing left worth keeping either.
    if (group.length === parent.divide.cols * parent.divide.rows) {
      const survivor = divisionCells[primary] ?? defaultDivisionCell();
      if (!survivor.typeId) {
        removeCell(parentId);
        return;
      }
      setCells((current) => {
        const currentParent = current[parentId];
        if (!currentParent?.divide) return current;
        return {
          ...current,
          [parentId]: {
            ...currentParent,
            typeId: survivor.typeId,
            typeConfig: survivor.typeConfig,
            pluginIds: survivor.pluginIds,
            divide: undefined,
          },
        };
      });
      selectCell(parentId);
      return;
    }

    setCells((current) => {
      const currentParent = current[parentId];
      if (!currentParent?.divide) return current;
      return {
        ...current,
        [parentId]: {
          ...currentParent,
          divide: { ...currentParent.divide, mergeGroups, cells: divisionCells },
        },
      };
    });
    setSelectedDivisionIndices([primary]);
  }

  function unmergeDivision() {
    if (selectedCellIndices.length !== 1 || selectedDivisionIndices.length !== 1) return;
    const parentId = selectedCellIndices[0];
    const subId = selectedDivisionIndices[0];
    setCells((current) => {
      const parent = current[parentId];
      if (!parent?.divide) return current;
      return {
        ...current,
        [parentId]: {
          ...parent,
          divide: {
            ...parent.divide,
            mergeGroups: removeMerge(parent.divide.mergeGroups, subId),
          },
        },
      };
    });
  }

  // "Delete" on however many divisions are currently selected — unlike a
  // top-level cell's Delete (`removeCell`, which drops it from its row
  // entirely), a division can't be removed on its own: the grid's
  // `cols`/`rows` count is fixed at Divide time (see `createDivideGrid`).
  // This just clears each selected one's plugin back to blank, the same
  // state every division but the first starts in — the divisions
  // themselves, and the rest of the grid, stay exactly as they were.
  function deleteSelectedDivisions() {
    if (selectedCellIndices.length !== 1 || selectedDivisionIndices.length === 0) return;
    const parentId = selectedCellIndices[0];
    const targets = new Set(selectedDivisionIndices);
    setCells((current) => {
      const parent = current[parentId];
      if (!parent?.divide) return current;
      const divisionCells = { ...parent.divide.cells };
      for (const id of targets) {
        if (divisionCells[id]?.typeId) divisionCells[id] = defaultDivisionCell();
      }
      return {
        ...current,
        [parentId]: { ...parent, divide: { ...parent.divide, cells: divisionCells } },
      };
    });
  }

  // "Divide" in the Actions menu — only reachable for a plain, unmerged,
  // not-yet-divided cell (see the menu item itself). Division 0 keeps the
  // cell's own plugin/config, so dividing doesn't discard it — every
  // other division starts blank instead, to be assigned by dropping a
  // plugin onto it, same as any brand-new cell (see `createDivideGrid`).
  function divideSelectedCell(cols: number, rows: number) {
    if (
      !layoutSelection ||
      layoutSelection.isMerged ||
      layoutSelection.cell.divide ||
      cols * rows <= 1 // see `DivideModal`'s own `isNoOp` guard
    ) {
      return;
    }
    const index = layoutSelection.index;
    const { typeId, typeConfig, pluginIds } = layoutSelection.cell;
    setCells((current) => ({
      ...current,
      [index]: {
        ...current[index],
        divide: createDivideGrid(cols, rows, { typeId, typeConfig, pluginIds }),
      },
    }));
    setDivideModalOpened(false);
    selectDivision({ parentId: index, subId: 0 });
  }

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

  // Copy the smallest-id selected cell's type, config and Mapping plugins
  // — not its own id or position — the same "primary" convention a merge
  // already uses to pick which member represents a group. Cloned so a
  // later Paste's own further edits can't reach back into this cell's
  // arrays/objects.
  function copySelectedCell() {
    if (selectedCellIndices.length === 0) return;
    const source = cells[Math.min(...selectedCellIndices)];
    if (!source) return;
    const { typeId, typeConfig, pluginIds, unit } = source;
    setCopiedCell({ typeId, typeConfig: { ...typeConfig }, pluginIds: [...pluginIds], unit });
  }

  // Records undo history — must run before the autosave effect below (so
  // it reads `skipFactoryAutosaveRef` while it's still whatever
  // `changeLayer`/`changeLayout` last set it to, before that effect's own
  // check resets it back to `false`): every actual edit to the display
  // pushes the disposition it's leaving onto `undoStackRef`, capped at
  // `MAX_UNDO_HISTORY`. Skipped for a layer/layout load (not a real edit
  // — same flag the autosave effect itself is skipped by) and for the
  // change `undo` itself just made (`isUndoingRef` — otherwise this would
  // immediately push the very state undo just popped right back on top).
  useEffect(() => {
    const next: FactoryLayout = { rowOverrides, cells, mergeGroups };
    const previous = previousFactoryLayoutRef.current;
    if (previous && !skipFactoryAutosaveRef.current && !isUndoingRef.current) {
      undoStackRef.current.push(previous);
      if (undoStackRef.current.length > MAX_UNDO_HISTORY) undoStackRef.current.shift();
    }
    isUndoingRef.current = false;
    previousFactoryLayoutRef.current = next;
  }, [cells, rowOverrides, mergeGroups]);

  // Cmd/Ctrl+Z — steps the display back to whatever `FactoryLayout` it had
  // right before its most recent edit. Scoped to the display's own data
  // (`cells`/`rowOverrides`/`mergeGroups`) only — not Layout/Layer
  // creation or Settings, both server round-tripped rather than plain
  // local state. Clears the current selection rather than trying to
  // carry it forward onto a disposition it may no longer make sense for
  // (a selected cell the undone edit removed, say).
  function undo() {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    isUndoingRef.current = true;
    setRowOverrides(previous.rowOverrides);
    setCells(previous.cells);
    setMergeGroups(previous.mergeGroups);
    setSelectedCellIndices([]);
    setSelectedDivisionIndices([]);
    setSelectedEmptyRow(null);
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
  // Caps size/Gap size/the display's own size changed since it was set.
  const gridItemsY =
    layout?.max_rows != null
      ? Math.min(layout.max_rows, computedGridItemsY)
      : computedGridItemsY;
  // The display's full grid — see `gridRows`: a row starts with no cells at
  // all, and only gets any once a plugin is dropped on it.
  const rows = gridRows(gridItemsY, rowOverrides);

  // Drops a freshly-typed cell onto the end of `row`'s empty space — see
  // `Factory`'s trailing drop target. Generates the new cell's id and
  // selects it in the same stroke.
  function createCell(row: number, cell: GridCell) {
    const { rows: updatedRows, id } = addCellToRow(rows, row);
    setRowOverrides((current) => ({ ...current, [row]: updatedRows[row] }));
    setCells((current) => ({ ...current, [id]: cell }));
    setSelectedCellIndices([id]);
    setSelectedEmptyRow(null);
  }

  // Drags `id` (a plain, unmerged cell — `Factory` only ever lets one of
  // those be dragged in the first place) out of its row and back in
  // right before `beforeId` (`null` for the row's own end) — the same
  // row, to reorder it, or a different one entirely. No-ops if it
  // doesn't actually fit there: built the row it would land in as if the
  // move had already happened, then reused `maxUnitForCell`'s own
  // budget math (the same check a resize already goes through) against
  // that, rather than a fresh one of its own.
  function moveCell(id: number, targetRow: number, beforeId: number | null) {
    const sourceRow = rowOf(id, rows);
    const cell = cells[id];
    if (sourceRow === -1 || !cell || groupOf(id, mergeGroups).length > 1) return;

    const withoutSource = rows.map((cellIds, row) =>
      row === sourceRow ? cellIds.filter((cellId) => cellId !== id) : cellIds,
    );
    const targetCellIds = withoutSource[targetRow] ?? [];
    const insertAt = beforeId !== null ? targetCellIds.indexOf(beforeId) : -1;
    const nextTargetCellIds =
      insertAt === -1
        ? [...targetCellIds, id]
        : [...targetCellIds.slice(0, insertAt), id, ...targetCellIds.slice(insertAt)];
    const nextRows = withoutSource.map((cellIds, row) =>
      row === targetRow ? nextTargetCellIds : cellIds,
    );

    const cap = maxUnitForCell(
      id,
      nextRows,
      cells,
      layoutSettings.physicalWidthMm,
      layoutSettings.unitMm,
      layoutSettings.gapMm,
    );
    if (cell.unit > cap) return;

    setRowOverrides((current) => ({
      ...current,
      [sourceRow]: nextRows[sourceRow],
      [targetRow]: nextRows[targetRow],
    }));
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
    setSelectedCellIndices((current) => current.filter((id) => id !== index));
  }

  // The single selected top-level cell — `null`, not just for an empty
  // selection, but also whenever more than one is selected: there's no
  // single "the" cell for Properties/Divide to act on then (see the
  // context menu instead, keyed off `selectedCellIndices` directly for
  // its own multi-select branches).
  const selectedCellIndex =
    selectedCellIndices.length === 1 ? selectedCellIndices[0] : null;
  const selectedCell =
    selectedCellIndex !== null ? cells[selectedCellIndex] : undefined;
  const layoutSelection =
    selectedCellIndex !== null && selectedCell
      ? {
          index: selectedCellIndex,
          cell: selectedCell,
          isMerged: groupOf(selectedCellIndex, mergeGroups).length > 1,
          canRemove: canRemoveCell(selectedCellIndex, rows, mergeGroups),
        }
      : null;

  // Whether every currently-selected top-level cell is reachable from
  // every other by a chain of shared edges — the condition for "Merge" to
  // show up on multiple selected cells (see `mergeSelectedCells`); a
  // multi-selection that isn't only ever offers Delete.
  const isCellSelectionContiguous =
    selectedCellIndices.length > 1 &&
    cellsAreContiguous(
      selectedCellIndices,
      (id) => cellRect(id, rows, cells, layoutSettings.unitMm, layoutSettings.gapMm),
      layoutSettings.gapMm,
    );

  // Which divisions of `selectedCellIndex`'s own divided cell (see
  // `GridCell.divide`) are the real focus, instead of that cell as a
  // whole — takes priority over `layoutSelection` wherever both could
  // apply (the Properties tab, the context menu) since `Factory` only
  // ever routes a click within a divided cell's own area to one of its
  // divisions (see `selectDivision`), never to the divided cell as a
  // whole. `null` unless exactly one division is selected — same
  // reasoning as `layoutSelection` above, and for the same reason
  // (Properties has one cell's worth of fields to show).
  const selectedDivisionId =
    selectedDivisionIndices.length === 1 ? selectedDivisionIndices[0] : null;
  const divisionSelection =
    selectedCellIndex !== null &&
    selectedCell?.divide &&
    selectedDivisionId !== null
      ? {
          parentId: selectedCellIndex,
          subId: selectedDivisionId,
          cell: selectedCell.divide.cells[selectedDivisionId] ?? defaultDivisionCell(),
          isMerged:
            groupOf(selectedDivisionId, selectedCell.divide.mergeGroups).length > 1,
        }
      : null;

  // Same idea as `isCellSelectionContiguous`, scoped to the selected
  // cell's own division grid — plain row/column adjacency there (see
  // `divisionsAreContiguous`), not real rects.
  const isDivisionSelectionContiguous =
    selectedCellIndex !== null &&
    selectedCell?.divide != null &&
    selectedDivisionIndices.length > 1 &&
    divisionsAreContiguous(selectedDivisionIndices, selectedCell.divide.cols);

  const emptySelection =
    selectedEmptyRow !== null
      ? {
          row: selectedEmptyRow,
          // Whether the copied cell (if any) still fits in this row's
          // remaining Unit budget — see `pasteToEmptyRow`. Pasting is only
          // ever offered onto empty space now, not next to an already
          // filled cell.
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
    setSelectedCellIndices([id]);
    setSelectedEmptyRow(null);
  }

  // Whether any division of the sole selected cell is the real focus
  // right now, as opposed to plain top-level cells — used below to route
  // Backspace to the right bulk action, and to keep Copy (not implemented
  // for divisions) from firing while one's selected.
  const hasDivisionSelection =
    selectedCellIndices.length === 1 && selectedDivisionIndices.length > 0;
  const hasCellSelection = selectedCellIndices.length > 0 && !hasDivisionSelection;
  // Copy only ever shows in the context menu for a single selected cell
  // — never for a multi-selection, contiguous or not (see the context
  // menu below) — so Cmd/Ctrl+C has to respect the same rule rather than
  // firing for any non-empty cell selection.
  const canCopySelection = hasCellSelection && selectedCellIndices.length === 1;

  // The context menu's own shortcuts, all Layout-mode-only and all no-ops
  // while the user is actually typing into a text field somewhere else (a
  // plugin's config, a name field…) rather than working the display:
  // Backspace deletes whatever's selected, Cmd/Ctrl+C copies a cell,
  // Cmd/Ctrl+V pastes into empty space. Read through a ref (rather than
  // listed as effect deps) so the listener is attached once, not
  // re-subscribed on every render.
  const anyModalOpen = Boolean(
    settingsOpened || layoutEditorOpened || layerEditorOpened || confirmDelete || divideModalOpened,
  );
  const layoutShortcutsRef = useRef({
    mode,
    anyModalOpen,
    hasCellSelection,
    hasDivisionSelection,
    canCopySelection,
    emptySelection,
    undo,
    deleteSelectedCells,
    deleteSelectedDivisions,
    copySelectedCell,
    pasteToEmptyRow,
  });
  useEffect(() => {
    layoutShortcutsRef.current = {
      mode,
      anyModalOpen,
      hasCellSelection,
      hasDivisionSelection,
      canCopySelection,
      emptySelection,
      undo,
      deleteSelectedCells,
      deleteSelectedDivisions,
      copySelectedCell,
      pasteToEmptyRow,
    };
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const {
        mode,
        anyModalOpen,
        hasCellSelection,
        hasDivisionSelection,
        canCopySelection,
        emptySelection,
        undo,
        deleteSelectedCells,
        deleteSelectedDivisions,
        copySelectedCell,
        pasteToEmptyRow,
      } = layoutShortcutsRef.current;
      const target = event.target as HTMLElement | null;
      const isTyping = Boolean(
        target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable),
      );
      // Cmd/Ctrl+Z — independent of `mode`/selection (unlike every other
      // shortcut below), but still not while a modal has its own fields
      // to undo through normally, or while typing anywhere else.
      if (
        !anyModalOpen &&
        !isTyping &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        undo();
        return;
      }
      if (
        mode !== "layout" ||
        isTyping ||
        (!hasCellSelection && !hasDivisionSelection && !emptySelection)
      ) {
        return;
      }
      const withModifier = event.metaKey || event.ctrlKey;
      // A division being the real focus must win here — otherwise
      // Backspace would fall through to `deleteSelectedCells` and delete
      // the whole divided cell, every other division along with it,
      // rather than just clearing the selected one(s)' own plugin (a
      // division can never be removed on its own, only cleared).
      if (event.key === "Backspace" && hasDivisionSelection) {
        event.preventDefault();
        deleteSelectedDivisions();
      } else if (event.key === "Backspace" && hasCellSelection) {
        event.preventDefault();
        deleteSelectedCells();
      } else if (canCopySelection && withModifier && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelectedCell();
      } else if (withModifier && event.key.toLowerCase() === "v") {
        if (emptySelection?.canPaste) {
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
              layoutId={layout.id}
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
                rows={rows}
                cells={cells}
                onCellsChange={setCells}
                onCreateCell={createCell}
                onMoveCell={moveCell}
                mergeGroups={mergeGroups}
                selectedCellIndices={selectedCellIndices}
                onSelectCell={selectCell}
                onToggleCell={toggleCellSelection}
                selectedEmptyRow={selectedEmptyRow}
                onSelectEmpty={selectEmptyRow}
                selectedDivisionIndices={selectedDivisionIndices}
                onSelectDivision={selectDivision}
                onToggleDivision={toggleDivisionSelection}
                isDisplaySelected={displaySelected}
                onSelectDisplay={selectDisplay}
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

              {/* One shared right-click context menu (see `Factory`'s
                  `onContextMenu` and `handleContextMenu` above) — its
                  content switches on `contextMenu.kind`, reading whichever
                  selection Factory already made for it
                  (`layoutSelection`/`divisionSelection`/`emptySelection`/
                  `displaySelected`) the same way each used to feed its own
                  floating "Actions" button. Anchored to an invisible,
                  zero-size target positioned at the click itself instead
                  of a fixed on-screen spot, so it opens right where the
                  cursor was. */}
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
                      selectedCellIndices.length > 0 && (
                        <>
                          {selectedCellIndices.length === 1 && layoutSelection && (
                            <>
                              {layoutSelection.isMerged && (
                                <Menu.Item leftSection={<MdCallSplit />} onClick={unmerge}>
                                  Unmerge
                                </Menu.Item>
                              )}
                              {!layoutSelection.isMerged && !layoutSelection.cell.divide && (
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
                                onClick={copySelectedCell}
                              >
                                Copy
                              </Menu.Item>
                              {layoutSelection.canRemove && (
                                <Menu.Item
                                  color="red"
                                  leftSection={<MdDelete />}
                                  rightSection={<ShortcutHint>⌫</ShortcutHint>}
                                  onClick={() => removeCell(layoutSelection.index)}
                                >
                                  Delete
                                </Menu.Item>
                              )}
                            </>
                          )}
                          {selectedCellIndices.length > 1 && isCellSelectionContiguous && (
                            <>
                              <Menu.Item
                                leftSection={<MdCallMerge />}
                                onClick={mergeSelectedCells}
                              >
                                Merge
                              </Menu.Item>
                              <Menu.Item
                                color="red"
                                leftSection={<MdDelete />}
                                rightSection={<ShortcutHint>⌫</ShortcutHint>}
                                onClick={deleteSelectedCells}
                              >
                                Delete
                              </Menu.Item>
                            </>
                          )}
                          {selectedCellIndices.length > 1 && !isCellSelectionContiguous && (
                            <Menu.Item
                              color="red"
                              leftSection={<MdDelete />}
                              rightSection={<ShortcutHint>⌫</ShortcutHint>}
                              onClick={deleteSelectedCells}
                            >
                              Delete
                            </Menu.Item>
                          )}
                        </>
                      )}

                    {contextMenu.kind === "division" &&
                      mode === "layout" &&
                      selectedDivisionIndices.length > 0 && (
                        <>
                          {selectedDivisionIndices.length === 1 && divisionSelection && (
                            <>
                              {divisionSelection.isMerged && (
                                <Menu.Item
                                  leftSection={<MdCallSplit />}
                                  onClick={unmergeDivision}
                                >
                                  Unmerge
                                </Menu.Item>
                              )}
                              {divisionSelection.cell.typeId && (
                                <Menu.Item
                                  color="red"
                                  leftSection={<MdDelete />}
                                  rightSection={<ShortcutHint>⌫</ShortcutHint>}
                                  onClick={deleteSelectedDivisions}
                                >
                                  Delete
                                </Menu.Item>
                              )}
                            </>
                          )}
                          {selectedDivisionIndices.length > 1 && isDivisionSelectionContiguous && (
                            <>
                              <Menu.Item
                                leftSection={<MdCallMerge />}
                                onClick={mergeSelectedDivisions}
                              >
                                Merge
                              </Menu.Item>
                              <Menu.Item
                                color="red"
                                leftSection={<MdDelete />}
                                rightSection={<ShortcutHint>⌫</ShortcutHint>}
                                onClick={deleteSelectedDivisions}
                              >
                                Delete
                              </Menu.Item>
                            </>
                          )}
                          {selectedDivisionIndices.length > 1 && !isDivisionSelectionContiguous && (
                            <Menu.Item
                              color="red"
                              leftSection={<MdDelete />}
                              rightSection={<ShortcutHint>⌫</ShortcutHint>}
                              onClick={deleteSelectedDivisions}
                            >
                              Delete
                            </Menu.Item>
                          )}
                        </>
                      )}

                    {contextMenu.kind === "row" && mode === "layout" && emptySelection && (
                      <Menu.Item
                        leftSection={<MdContentPaste />}
                        rightSection={<ShortcutHint>{MOD_KEY_LABEL}V</ShortcutHint>}
                        disabled={!emptySelection.canPaste}
                        onClick={pasteToEmptyRow}
                      >
                        Paste
                      </Menu.Item>
                    )}

                    {contextMenu.kind === "display" && (
                      <>
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
                divisionSelection
                  ? { index: divisionSelection.subId, cell: divisionSelection.cell }
                  : layoutSelection
              }
              onLayoutCellChange={
                divisionSelection
                  ? (subId, patch) =>
                      changeDivisionCell(divisionSelection.parentId, subId, patch)
                  : changeCell
              }
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
      {divideModalOpened && layoutSelection && (
        <DivideModal
          onClose={() => setDivideModalOpened(false)}
          onDivide={divideSelectedCell}
        />
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
          layoutId={layout.id}
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
