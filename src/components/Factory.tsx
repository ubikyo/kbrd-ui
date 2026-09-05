import { Box } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type {
  DragEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
} from "react";

import {
  FALLBACK_HEIGHT,
  FALLBACK_WIDTH,
  getDevice,
  type DeviceStatus,
} from "../api/device";
import { pluginById } from "../plugins/registry";
import {
  defaultDivisionCell,
  defaultGridCell,
  MIN_UNIT,
  UNIT_STEP,
  type DivideGrid,
  type GridCell,
  type LayoutSettings,
  type MergeGroups,
} from "../types/layout";
import {
  divisionCellRect,
  divisionOutline,
  gridSizeMm,
  groupOf,
  layoutRow,
  maxItems,
  maxUnitForCell,
  mergedOutline,
  pitchMm,
  primaryOf,
  remainingUnitsInRow,
  type CellRect,
} from "../utils/layout";
import LayoutItem, { ResizeGrip } from "./LayoutItem";

const PADDING = 60;
const POLL_INTERVAL_MS = 5000;
const LAYOUT_KEY_PLUGIN_ID = "kbrd.layout-key";
const PLUGIN_DRAG_TYPE = "application/kbrd-plugin";
// A pointer has to travel at least this far (in screen px) before a
// pointer-down on a cell counts as dragging it to move it, rather than
// just being the press half of an ordinary click — see
// `handleCellPointerDown`.
const MOVE_THRESHOLD_PX = 4;
// Same green `LayoutItem` uses for a selected cell.
const DISPLAY_SELECTED_STROKE = "#00ff00";

type Size = {
  width: number;
  height: number;
};

// What's currently under the drag cursor: an existing cell, a row's
// trailing empty space (see `remainingUnitsInRow`) — there's no "default
// cell" to drop onto until one of these creates one — or a division of a
// divided cell (see `GridCell.divide`).
type DropTarget =
  | { kind: "cell"; id: number }
  | { kind: "row"; row: number }
  | { kind: "division"; parentId: number; subId: number };

// Where a dragged cell would land if dropped right now — the green
// insertion line's own position (`xMm`, spanning `row`'s own height) and
// which existing cell (if any) it would insert before, for `onMoveCell`.
// `beforeId: null` means the row's own end (including a fully empty row).
type MoveDropTarget = {
  row: number;
  beforeId: number | null;
  xMm: number;
};

// Identifies one division of a divided cell — `parentId` is that cell's
// own (top-level) id, `subId` one of its `divide.cells` keys.
type DivisionRef = { parentId: number; subId: number };

// What a right-click landed on — see `onContextMenu`. Resolved the same
// way its equivalent left-click target is (a merged cell's own primary,
// a division's own primary), so `App` can select it and show its own
// context menu without re-deriving any of that itself.
export type ContextMenuTarget =
  | { kind: "cell"; id: number }
  | ({ kind: "division" } & DivisionRef)
  | { kind: "row"; row: number }
  | { kind: "display" };

type Props = LayoutSettings & {
  mode: "layout" | "mapping";
  // The display's full grid — see `gridRows`. A row starts with no cells at
  // all; `App` owns the actual list.
  rows: number[][];
  cells: Record<number, GridCell>;
  onCellsChange: (
    update: (current: Record<number, GridCell>) => Record<number, GridCell>,
  ) => void;
  // Drops a freshly-typed cell onto the end of `row`'s empty space —
  // dropping a Layout plugin where there's no cell yet.
  onCreateCell: (row: number, cell: GridCell) => void;
  // Drags a plain, unmerged cell to reposition it — same row (reorder)
  // or a different one entirely — right before `beforeId` (`null` for
  // the row's own end). No-ops in `App` if it doesn't actually fit
  // there — see `handleCellDragOver`'s own insertion-point math and
  // `onMoveCell`'s Unit-budget check.
  onMoveCell: (id: number, targetRow: number, beforeId: number | null) => void;
  mergeGroups: MergeGroups;
  // Every currently-selected top-level cell's own primary id — plain
  // click replaces this with a singleton (or empty, toggling the sole
  // member off); Cmd/Ctrl+click toggles one in or out of it instead, for
  // the multi-select Merge/Delete now live in `App`'s context menu (see
  // its own `contextMenu`) rather than the old click-an-adjacent-cell
  // flow.
  selectedCellIndices: number[];
  onSelectCell: (index: number | null) => void;
  onToggleCell: (index: number) => void;
  // A row's trailing empty space (or a fully empty row), selected instead
  // of a real cell — mutually exclusive with `selectedCellIndices`. Lets a
  // copied plugin be pasted straight into space nothing has claimed yet.
  selectedEmptyRow: number | null;
  onSelectEmpty: (row: number) => void;
  // Which divisions of `selectedCellIndices`' sole cell (if it's divided)
  // are the real focus, instead of the divided cell as a whole — see
  // `GridCell.divide`. Empty while a plain, undivided cell (or nothing)
  // is selected. Same plain-click-replaces / Cmd-click-toggles rule as
  // `selectedCellIndices`, just scoped to this one cell's own divisions.
  selectedDivisionIndices: number[];
  onSelectDivision: (ref: DivisionRef) => void;
  onToggleDivision: (ref: DivisionRef) => void;
  // The physical screen itself (the white outline) selected as its own
  // target — mutually exclusive with a cell — for `App`'s Layout/Layer
  // context menu, the same way selecting a cell shows its own.
  isDisplaySelected: boolean;
  onSelectDisplay: () => void;
  // Right-click, anywhere on the display — reports the client-space
  // coordinates to open `App`'s context menu at, and what was actually
  // under the cursor (already selected the same way its left-click
  // equivalent would be, by the time this fires — see `handleClick` and
  // friends). Layout-only for a cell/division/row: in Mapping mode
  // there's nothing of the sort to act on, so the browser's own context
  // menu is left alone instead.
  onContextMenu: (x: number, y: number, target: ContextMenuTarget) => void;
  // "Resize" in the Actions menu — while off, no cell's grip renders (see
  // `pendingGrips`) and dragging one to resize is impossible, not just
  // harder to reach.
  resizeEnabled: boolean;
  // The current layout's own Max width (1U) override (see the Layout
  // editor's Geometry tab), clamped below to whatever still fits — `null`
  // means no override, i.e. use the full computed width. Max height (1U)
  // needs no equivalent prop: `App` already bakes it into `rows`' own
  // length (see `gridItemsY`), so `itemsY` below just reads that back.
  maxColumns: number | null;
};

/**
 * Scaffold for the redesigned Preview: temporarily replaces `<Preview>`
 * while that component is rebuilt from scratch. The display — a rectangle
 * standing in for KBRD-DEV's physical screen, sized to that screen's
 * aspect ratio (fetched from KBRD-API, which KBRD-DEV keeps up to date)
 * and fit to the available surface — is drawn as part of the same SVG as
 * the key grid rather than a separate bordered box around it, so both
 * share one coordinate system and stay centered together. SVG (rather
 * than a CSS grid) is what lets a merged group's shape become a stepped
 * outline (an ISO Enter key) instead of a plain rectangle.
 *
 * Each row is laid out as an actual flow (`layoutRow`): a 1.25U key really
 * spans 1.25 pitches of row space (see `cellSizeMm`), everything after it
 * shifts over. A row holds no cells at
 * all until something's actually dropped on it — whatever's left of its
 * Unit budget (`remainingUnitsInRow`) renders as one trailing, dashed drop
 * target rather than a pre-existing "default" cell.
 *
 * Every cell — and a row's trailing empty space — is a drop target for
 * the plugins dragged from `<Inspector>`'s Plugins tab: a Layout plugin
 * (kbrd.layout-key / kbrd.layout-space) sets a cell's kind while in Layout
 * mode (dropping on empty space creates a brand new cell there instead),
 * and, once a cell is a Key, an Invoke/Display plugin can be dropped onto
 * it while in Mapping mode. Adjacent cells can also be merged into one
 * (see the Actions menu in Layout mode) — including a row's still-empty
 * space, which becomes a brand-new, plugin-less cell as part of the merge
 * rather than needing one typed first; every member of a merge shows and
 * edits the same `GridCell`, the group's smallest index (`primaryOf`).
 * Dropping a plugin selects the cell; clicking one does too (and clicking
 * a row's empty space selects *that*, so a copied plugin can be pasted
 * straight onto it), unless a merge is in progress, in which case clicking
 * a valid neighbour — cell or empty space alike — completes it.
 * The whole grid — cells, their merges, which populate each row — is
 * autosaved onto the current layer's own `factory_layout` (see the
 * effect in `App`) and reloaded whenever the user switches layer, as
 * one opaque JSON blob rather than per-key rows: these synthetic cells
 * still have no real `key_ref` of their own to save the usual way.
 */
export default function Factory({
  unitMm,
  physicalWidthMm,
  physicalHeightMm,
  gapMm,
  mode,
  rows,
  cells,
  onCellsChange,
  onCreateCell,
  onMoveCell,
  mergeGroups,
  selectedCellIndices,
  onSelectCell,
  onToggleCell,
  selectedEmptyRow,
  onSelectEmpty,
  selectedDivisionIndices,
  onSelectDivision,
  onToggleDivision,
  isDisplaySelected,
  onSelectDisplay,
  onContextMenu,
  resizeEnabled,
  maxColumns,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [device, setDevice] = useState<DeviceStatus>({ connected: false });
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  // Where a cell currently being dragged (see `handleCellPointerDown`)
  // would land if dropped right now — drawn as a green insertion line.
  const [moveDropTarget, setMoveDropTarget] = useState<MoveDropTarget | null>(null);
  // Mirrors `moveDropTarget`, read from the window `pointerup` handler
  // below instead of the state itself so that effect doesn't need to
  // re-subscribe on every single pointer move during a drag (`moveDropTarget`
  // changes continuously; this ref doesn't need to trigger a render).
  const moveDropTargetRef = useRef<MoveDropTarget | null>(null);
  function setMoveTarget(target: MoveDropTarget | null) {
    moveDropTargetRef.current = target;
    setMoveDropTarget(target);
  }
  // The cell currently being picked up to move it (see
  // `handleCellPointerDown`) — a plain ref, not state, since it's only
  // ever read from the window pointermove/pointerup handlers below, never
  // rendered directly. `hasMoved` only turns true once the pointer's
  // travelled past `MOVE_THRESHOLD_PX`, so a plain click (press then
  // release without dragging) still selects the cell normally instead of
  // being swallowed as a zero-distance move.
  const movingRef = useRef<{
    id: number;
    startClientX: number;
    startClientY: number;
    hasMoved: boolean;
  } | null>(null);
  // Set right when a move actually happens, so the `click` browsers still
  // fire after a `pointerup` doesn't also re-select/toggle the cell that
  // was just dragged — read and cleared by `handleClick`.
  const suppressClickRef = useRef(false);
  // The cell currently being dragged wider/narrower from its right-edge
  // handle (`LayoutItem`'s `onResizeStart`) — `startUnit` is its Unit
  // *before* the drag started, so every pointer move recomputes the new
  // Unit from that same fixed baseline rather than compounding deltas.
  const [resizing, setResizing] = useState<{
    id: number;
    startClientX: number;
    startUnit: number;
  } | null>(null);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      getDevice().then(
        (status) => {
          if (!cancelled) setDevice(status);
        },
        () => {},
      );
    }
    poll();
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const clearDropTarget = () => {
      setDropTarget(null);
      setMoveDropTarget(null);
    };
    window.addEventListener("dragend", clearDropTarget);
    window.addEventListener("drop", clearDropTarget);
    return () => {
      window.removeEventListener("dragend", clearDropTarget);
      window.removeEventListener("drop", clearDropTarget);
    };
  }, []);

  const ratio = device.connected
    ? device.width / device.height
    : FALLBACK_WIDTH / FALLBACK_HEIGHT;

  const display = (() => {
    if (viewport.width <= 0 || viewport.height <= 0) return null;

    let width = viewport.width;
    let height = width / ratio;
    if (height > viewport.height) {
      height = viewport.height;
      width = height * ratio;
    }
    return { width, height };
  })();
  // The SVG's own scale — real screen pixels per mm of `viewBox` — used to
  // convert a fixed-pixel size (the resize grip, see `LayoutItem`) into
  // this SVG's mm-space, and pixel drag deltas back into mm below.
  const pxPerMm = (() => {
    if (!display || physicalWidthMm <= 0) return 0;
    return display.width / physicalWidthMm;
  })();

  // `App` already clamped any Max height (1U) override into `rows`' own
  // length before it ever reaches here — see `gridItemsY`.
  const itemsY = rows.length;
  const computedItemsX = maxItems(physicalWidthMm, unitMm, gapMm);
  const itemsX =
    maxColumns != null ? Math.min(maxColumns, computedItemsX) : computedItemsX;
  const rowPitch = pitchMm(unitMm, gapMm);
  // Rows, as a block, are centered both ways: their own reference
  // footprint (itemsY rows tall, itemsX 1U cells wide) is often slightly
  // smaller than the physical display on each axis (maxItems floors
  // down), so the leftover margin is split evenly on every side rather
  // than left pinned to the top-left corner.
  const gridOffsetY =
    (physicalHeightMm - gridSizeMm(itemsY, unitMm, gapMm)) / 2;
  const referenceRowWidthMm = gridSizeMm(itemsX, unitMm, gapMm);
  const gridOffsetX = (physicalWidthMm - referenceRowWidthMm) / 2;

  // Drag-resizing a cell from its right-edge handle: pixels moved on
  // screen convert to mm via the SVG's own scale (`pxPerMm`), then to
  // Units, snapped to `UNIT_STEP` and capped by `maxUnitForCell` so it can
  // never outgrow its row's budget. A cell's width grows by one whole
  // *pitch* per +1 Unit — see `cellSizeMm` — not by `unitMm` (its cap
  // size) alone.
  useEffect(() => {
    if (!resizing || !display) return;

    function handleMove(event: PointerEvent) {
      if (!resizing || pxPerMm <= 0) return;
      const deltaUnit =
        (event.clientX - resizing.startClientX) / pxPerMm / pitchMm(unitMm, gapMm);
      const rawUnit = resizing.startUnit + deltaUnit;
      const snapped = Math.round(rawUnit / UNIT_STEP) * UNIT_STEP;
      const cap = maxUnitForCell(
        resizing.id,
        rows,
        cells,
        physicalWidthMm,
        unitMm,
        gapMm,
      );
      const maxSnapped = Math.floor(cap / UNIT_STEP) * UNIT_STEP;
      const unit =
        Math.round(Math.max(MIN_UNIT, Math.min(snapped, maxSnapped)) * 100) /
        100;

      onCellsChange((current) => {
        const cell = current[resizing.id];
        if (!cell || cell.unit === unit) return current;
        return { ...current, [resizing.id]: { ...cell, unit } };
      });
    }

    function handleUp() {
      setResizing(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [
    resizing,
    display,
    pxPerMm,
    physicalWidthMm,
    unitMm,
    gapMm,
    rows,
    cells,
    onCellsChange,
  ]);

  function handleResizeStart(
    id: number,
    startUnit: number,
    event: ReactPointerEvent<SVGGElement>,
  ) {
    setResizing({ id, startClientX: event.clientX, startUnit });
  }

  // Dragging a cell to move it — plain pointer events (`pointerdown` here,
  // `pointermove`/`pointerup` on the window below) rather than native
  // HTML5 drag-and-drop, which SVG elements support too inconsistently
  // across browsers (Chromium in particular) to rely on for this — the
  // exact same reason the resize grip just above is built the same way.
  useEffect(() => {
    // Where a cell dragged from `row` (its own current row, `excludeId` —
    // it doesn't insert relative to itself) would land, given its own
    // cursor position converted to this row's local mm-space (`xMm`):
    // whichever existing cell's own midpoint the cursor hasn't yet
    // reached is where it lands, or the row's end if it's past all of
    // them.
    function findInsertionPoint(row: number, xMm: number, excludeId: number): MoveDropTarget {
      const cellIds = (rows[row] ?? []).filter((id) => id !== excludeId);
      const slots = layoutRow(cellIds, cells, unitMm, gapMm);
      for (const slot of slots) {
        if (xMm < slot.x + slot.width / 2) return { row, beforeId: slot.id, xMm: slot.x };
      }
      const last = slots[slots.length - 1];
      const endX = last ? last.x + last.width + gapMm / 2 : 0;
      return { row, beforeId: null, xMm: endX };
    }

    function handleMove(event: PointerEvent) {
      const moving = movingRef.current;
      if (!moving || !display || pxPerMm <= 0) return;
      if (!moving.hasMoved) {
        const dx = event.clientX - moving.startClientX;
        const dy = event.clientY - moving.startClientY;
        if (Math.hypot(dx, dy) < MOVE_THRESHOLD_PX) return;
        moving.hasMoved = true;
      }
      const svg = svgRef.current;
      if (!svg) return;
      const screenRect = svg.getBoundingClientRect();
      const mmX = (event.clientX - screenRect.left) / pxPerMm - gridOffsetX;
      const mmY = (event.clientY - screenRect.top) / pxPerMm - gridOffsetY;
      const row = Math.max(0, Math.min(itemsY - 1, Math.floor(mmY / rowPitch)));
      setMoveTarget(findInsertionPoint(row, mmX, moving.id));
    }

    function handleUp() {
      const moving = movingRef.current;
      movingRef.current = null;
      if (moving?.hasMoved) {
        suppressClickRef.current = true;
        const target = moveDropTargetRef.current;
        if (target) onMoveCell(moving.id, target.row, target.beforeId);
      }
      setMoveTarget(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [display, pxPerMm, gridOffsetX, gridOffsetY, itemsY, rowPitch, rows, cells, unitMm, gapMm, onMoveCell]);

  function handleCellPointerDown(id: number, event: ReactPointerEvent<SVGGElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    movingRef.current = {
      id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      hasMoved: false,
    };
  }

  function handleCellDragOver(id: number, event: DragEvent<SVGGElement>) {
    if (!event.dataTransfer.types.includes(PLUGIN_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropTarget({ kind: "cell", id });
  }

  function sameDropTarget(a: DropTarget, b: DropTarget): boolean {
    if (a.kind !== b.kind) return false;
    if (a.kind === "cell" && b.kind === "cell") return a.id === b.id;
    if (a.kind === "row" && b.kind === "row") return a.row === b.row;
    if (a.kind === "division" && b.kind === "division") {
      return a.parentId === b.parentId && a.subId === b.subId;
    }
    return false;
  }

  function handleDragLeave(target: DropTarget) {
    setDropTarget((current) =>
      current && sameDropTarget(current, target) ? null : current,
    );
  }

  function handleClick(event: ReactMouseEvent<SVGGElement>, index: number) {
    // A cell click is never also a click on the display behind it — see
    // `handleSelectDisplay`, bound on the `<svg>` itself.
    event.stopPropagation();
    // The browser still fires a `click` right after the `pointerup` that
    // ends an actual move-drag (see the pointer effect above) — without
    // this, dropping a cell elsewhere would also re-select/toggle it.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const primary = primaryOf(index, mergeGroups);
    if (event.metaKey || event.ctrlKey) {
      onToggleCell(primary);
      return;
    }
    const isSoleSelection =
      selectedCellIndices.length === 1 && selectedCellIndices[0] === primary;
    onSelectCell(isSoleSelection ? null : primary);
  }

  function handleEmptyClick(
    row: number,
    event: ReactMouseEvent<SVGGElement>,
  ) {
    // Same as `handleClick` — never also a click on the display behind it.
    event.stopPropagation();
    onSelectEmpty(row);
  }

  function handleCellDrop(index: number, event: DragEvent<SVGGElement>) {
    const pluginId = event.dataTransfer.getData(PLUGIN_DRAG_TYPE);
    const plugin = pluginById(pluginId);
    if (!plugin) return;
    event.preventDefault();
    setDropTarget(null);
    const primary = primaryOf(index, mergeGroups);

    if (mode === "layout") {
      if (plugin.category !== "Layout") return;
      onCellsChange((current) => {
        const cell = current[primary];
        // Changing (or confirming) the cell's kind clears whatever
        // Mapping-mode plugins were attached to its previous kind, but
        // keeps its Unit exactly as it was.
        return {
          ...current,
          [primary]:
            cell?.typeId === plugin.id
              ? cell
              : {
                  ...defaultGridCell(cell?.unit),
                  typeId: plugin.id,
                  typeConfig: { ...plugin.defaultConfig },
                },
        };
      });
      onSelectCell(primary);
      return;
    }

    const cell = cells[primary];
    if (
      plugin.category === "Layout" ||
      cell?.typeId !== LAYOUT_KEY_PLUGIN_ID ||
      cell.pluginIds.includes(plugin.id)
    ) {
      return;
    }
    onCellsChange((current) => ({
      ...current,
      [primary]: { ...cell, pluginIds: [...cell.pluginIds, plugin.id] },
    }));
    onSelectCell(primary);
  }

  function handleRowDragOver(row: number, event: DragEvent<SVGGElement>) {
    if (
      mode !== "layout" ||
      !event.dataTransfer.types.includes(PLUGIN_DRAG_TYPE)
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropTarget({ kind: "row", row });
  }

  function handleRowDrop(row: number, event: DragEvent<SVGGElement>) {
    if (mode !== "layout") return;
    const pluginId = event.dataTransfer.getData(PLUGIN_DRAG_TYPE);
    const plugin = pluginById(pluginId);
    if (!plugin || plugin.category !== "Layout") return;
    const remaining = remainingUnitsInRow(
      row,
      rows,
      cells,
      physicalWidthMm,
      unitMm,
      gapMm,
    );
    if (remaining < MIN_UNIT) return;
    event.preventDefault();
    setDropTarget(null);
    onCreateCell(row, {
      ...defaultGridCell(Math.min(1, remaining)),
      typeId: plugin.id,
      typeConfig: { ...plugin.defaultConfig },
    });
  }

  // Same idea as `handleClick`, scoped to one cell's own divisions
  // (`divide.mergeGroups`) instead of the display's top-level `mergeGroups`
  // — completes a division-scoped merge in progress, or just selects the
  // division clicked. `parentRect` is that cell's own rect, already
  // computed once per row by the caller (see the render loop below).
  function handleDivisionClick(
    parentId: number,
    divide: DivideGrid,
    subId: number,
    event: ReactMouseEvent<SVGGElement>,
  ) {
    event.stopPropagation();
    const primary = primaryOf(subId, divide.mergeGroups);
    if (event.metaKey || event.ctrlKey) {
      onToggleDivision({ parentId, subId: primary });
      return;
    }
    const isSoleSelection =
      selectedCellIndices.length === 1 &&
      selectedCellIndices[0] === parentId &&
      selectedDivisionIndices.length === 1 &&
      selectedDivisionIndices[0] === primary;
    if (isSoleSelection) {
      onSelectCell(null);
      return;
    }
    onSelectDivision({ parentId, subId: primary });
  }

  function handleDivisionDragOver(
    parentId: number,
    subId: number,
    event: DragEvent<SVGGElement>,
  ) {
    if (!event.dataTransfer.types.includes(PLUGIN_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropTarget({ kind: "division", parentId, subId });
  }

  // Same idea as `handleCellDrop`, but writing into `cells[parentId]`'s
  // own nested `divide.cells` instead of the top-level `cells` map.
  function handleDivisionDrop(
    parentId: number,
    divide: DivideGrid,
    subId: number,
    event: DragEvent<SVGGElement>,
  ) {
    const pluginId = event.dataTransfer.getData(PLUGIN_DRAG_TYPE);
    const plugin = pluginById(pluginId);
    if (!plugin) return;
    event.preventDefault();
    setDropTarget(null);
    const primary = primaryOf(subId, divide.mergeGroups);

    if (mode === "layout") {
      if (plugin.category !== "Layout") return;
      onCellsChange((current) => {
        const parent = current[parentId];
        if (!parent?.divide) return current;
        const divCell = parent.divide.cells[primary];
        return {
          ...current,
          [parentId]: {
            ...parent,
            divide: {
              ...parent.divide,
              cells: {
                ...parent.divide.cells,
                [primary]:
                  divCell?.typeId === plugin.id
                    ? divCell
                    : {
                        ...defaultDivisionCell(),
                        typeId: plugin.id,
                        typeConfig: { ...plugin.defaultConfig },
                      },
              },
            },
          },
        };
      });
      onSelectDivision({ parentId, subId: primary });
      return;
    }

    const divCell = divide.cells[primary];
    if (
      plugin.category === "Layout" ||
      divCell?.typeId !== LAYOUT_KEY_PLUGIN_ID ||
      divCell.pluginIds.includes(plugin.id)
    ) {
      return;
    }
    onCellsChange((current) => {
      const parent = current[parentId];
      const existing = parent?.divide?.cells[primary];
      if (!parent?.divide || !existing) return current;
      return {
        ...current,
        [parentId]: {
          ...parent,
          divide: {
            ...parent.divide,
            cells: {
              ...parent.divide.cells,
              [primary]: { ...existing, pluginIds: [...existing.pluginIds, plugin.id] },
            },
          },
        },
      };
    });
    onSelectDivision({ parentId, subId: primary });
  }

  // Right-click handlers — select the target (mirrors the equivalent
  // left-click handler above, minus its merge-in-progress branch: a
  // context menu request is never itself the neighbour that completes a
  // merge) and report it to `App`, which opens its own context menu
  // there. Layout-mode only for anything but the display — nothing to act
  // on in Mapping mode, so the browser's own context menu is left alone.
  function handleCellContextMenu(index: number, event: ReactMouseEvent<SVGGElement>) {
    if (mode !== "layout") return;
    event.preventDefault();
    event.stopPropagation();
    const primary = primaryOf(index, mergeGroups);
    // Right-clicking a cell that's already part of the current
    // multi-selection opens the menu for that whole selection (standard
    // desktop convention); right-clicking outside it replaces the
    // selection with just this one cell, same as a plain click would.
    if (!selectedCellIndices.includes(primary)) onSelectCell(primary);
    onContextMenu(event.clientX, event.clientY, { kind: "cell", id: primary });
  }

  function handleDivisionContextMenu(
    parentId: number,
    divide: DivideGrid,
    subId: number,
    event: ReactMouseEvent<SVGGElement>,
  ) {
    if (mode !== "layout") return;
    event.preventDefault();
    event.stopPropagation();
    const primary = primaryOf(subId, divide.mergeGroups);
    const alreadyFocused =
      selectedCellIndices.length === 1 &&
      selectedCellIndices[0] === parentId &&
      selectedDivisionIndices.includes(primary);
    if (!alreadyFocused) onSelectDivision({ parentId, subId: primary });
    onContextMenu(event.clientX, event.clientY, { kind: "division", parentId, subId: primary });
  }

  function handleEmptyContextMenu(row: number, event: ReactMouseEvent<SVGGElement>) {
    if (mode !== "layout") return;
    event.preventDefault();
    event.stopPropagation();
    onSelectEmpty(row);
    onContextMenu(event.clientX, event.clientY, { kind: "row", row });
  }

  function handleDisplayContextMenu(event: ReactMouseEvent<SVGSVGElement>) {
    event.preventDefault();
    onSelectDisplay();
    onContextMenu(event.clientX, event.clientY, { kind: "display" });
  }

  // Collected while laying out each row's cells below, then rendered as
  // their own pass *after* every row — see `ResizeGrip` for why a grip
  // can't just render inline as part of its own cell.
  const pendingGrips: { id: number; bounds: CellRect; unit: number }[] = [];

  // Renders `parentId`'s own division grid (see `GridCell.divide`) in
  // place of the one plain `<LayoutItem>` an ordinary cell gets — one
  // `<LayoutItem>` per division *group* (a division merged with a
  // sibling renders once, from its primary, exactly like a top-level
  // merge does), laid out directly over `parentRect` with no gap between
  // any of them (`divisionCellRect`/`divisionOutline`), rather than going
  // through `layoutRow`'s ordinary same-row, `gapMm`-spaced flow.
  function renderDivisions(
    parentId: number,
    divide: DivideGrid,
    parentRect: CellRect,
    parentUnit: number,
  ) {
    const count = divide.cols * divide.rows;
    const cols = divide.cols;

    // Resolved once up front — both the border-dedup pass below and the
    // regular rendering pass need each division's group/primary and
    // highlighted state.
    const status = Array.from({ length: count }, (_, subId) => {
      const group = groupOf(subId, divide.mergeGroups);
      const primary = Math.min(...group);
      const isSelected =
        selectedCellIndices.length === 1 &&
        selectedCellIndices[0] === parentId &&
        selectedDivisionIndices.includes(primary);
      const isDropTarget =
        dropTarget?.kind === "division" &&
        dropTarget.parentId === parentId &&
        dropTarget.subId === primary;
      return { group, primary, isMerged: group.length > 1, isSelected, isDropTarget };
    });
    const isHighlighted = (subId: number) =>
      status[subId].isSelected || status[subId].isDropTarget;

    // Two adjacent, both-dashed divisions each stroking their own full
    // border would draw their shared edge twice — and since each one's
    // dash pattern starts counting from its own path's own start point,
    // the two independently-phased dashed strokes can land out of sync
    // and visually fill each other's gaps in, reading as one solid line
    // where neither one actually is. So a "baseline" division (unmerged,
    // not selected, not the drop target) never draws a side it shares
    // with another baseline one — only the side that "owns" it does
    // (right/bottom always wins over left/top — an arbitrary but
    // consistent tie-break, equivalent to a spreadsheet's own
    // border-collapse) — or with a highlighted one (whose own full
    // border already covers it). A merged group still traces its own
    // full outline unconditionally, same as before — including towards a
    // baseline neighbour, a rarer pairing this doesn't fully dedupe.
    const borderSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let subId = 0; subId < count; subId++) {
      if (status[subId].isMerged || isHighlighted(subId)) continue;
      const row = Math.floor(subId / cols);
      const col = subId % cols;
      const rect = divisionCellRect(subId, divide, parentRect);
      const neighbourOf = (dRow: number, dCol: number) => {
        const r = row + dRow;
        const c = col + dCol;
        return r < 0 || r >= divide.rows || c < 0 || c >= cols ? null : r * cols + c;
      };
      const drawsTowards = (dRow: number, dCol: number, owns: boolean) => {
        const otherId = neighbourOf(dRow, dCol);
        if (otherId === null) return true; // the grid's own outer edge
        if (isHighlighted(otherId)) return false; // its own full border covers it
        if (status[otherId].isMerged) return true; // accept the rare double-render risk
        return owns; // both baseline — only the owning side draws it
      };
      if (drawsTowards(0, -1, false)) {
        borderSegments.push({ x1: rect.x, y1: rect.y, x2: rect.x, y2: rect.y + rect.height });
      }
      if (drawsTowards(-1, 0, false)) {
        borderSegments.push({ x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y });
      }
      if (drawsTowards(0, 1, true)) {
        borderSegments.push({
          x1: rect.x + rect.width,
          y1: rect.y,
          x2: rect.x + rect.width,
          y2: rect.y + rect.height,
        });
      }
      if (drawsTowards(1, 0, true)) {
        borderSegments.push({
          x1: rect.x,
          y1: rect.y + rect.height,
          x2: rect.x + rect.width,
          y2: rect.y + rect.height,
        });
      }
    }

    const rendered = new Set<number>();
    // Whichever sibling comes later in this array visually wins on any
    // shared edge it still has (SVG paints in document order) — with
    // border-dedup above, that's now only ever a highlighted item next
    // to a baseline one it no longer draws anything towards anyway, but
    // this stays as a defensive ordering all the same, the same reason
    // `Factory` already renders the resize grip in its own pass after
    // every cell.
    const items: { key: string; priority: boolean; element: ReactElement }[] = [];
    for (let subId = 0; subId < count; subId++) {
      const { group, primary, isSelected, isDropTarget, isMerged } = status[subId];
      if (rendered.has(primary)) continue;
      rendered.add(primary);

      const divCell = divide.cells[primary];
      // A division with no plugin yet reads exactly like the row's own
      // trailing empty space (`isEmpty` there too): no text at all (see
      // `unit` below — `undefined` skips the size label the same way it
      // already does for `typeId`/`pluginIds`), and selecting it stays
      // dashed rather than solid, since there's nothing real there yet —
      // just a spot a plugin could still be dropped onto.
      const hasContent = Boolean(divCell?.typeId);
      const outline = isMerged ? divisionOutline(group, divide, parentRect) : null;
      const bounds = outline?.bounds ?? divisionCellRect(primary, divide, parentRect);
      // Only the width matters for a division's own size label — its
      // height always matches the row's fixed cap size regardless of how
      // many `divide.rows` share it. Expressed as a share of the parent
      // cell's own Unit, by its own share of the parent's physical width
      // (its bounding box, so a merged, possibly stepped group still
      // reads as its true on-screen footprint) — rounded for a clean
      // "0.5U"-style label instead of a repeating decimal.
      const unit = hasContent
        ? Math.round((bounds.width / parentRect.width) * parentUnit * 100) / 100
        : undefined;

      items.push({
        key: `division-${parentId}-${primary}`,
        priority: isSelected || isDropTarget,
        element: (
          <LayoutItem
            key={`division-${parentId}-${primary}`}
            bounds={bounds}
            path={outline?.path}
            labelBounds={outline?.labelBounds}
            typeId={divCell?.typeId}
            pluginIds={divCell?.pluginIds}
            unit={unit}
            isEmpty={!hasContent}
            isSelected={isSelected}
            isDropTarget={isDropTarget}
            // A baseline (unmerged, unhighlighted) division's border is
            // drawn once, deduplicated, in `borderSegments` above instead.
            showBorder={isMerged || isSelected || isDropTarget}
            onClick={(event) => handleDivisionClick(parentId, divide, primary, event)}
            onContextMenu={(event) =>
              handleDivisionContextMenu(parentId, divide, primary, event)
            }
            onDragOver={(event) => handleDivisionDragOver(parentId, primary, event)}
            onDragLeave={() =>
              handleDragLeave({ kind: "division", parentId, subId: primary })
            }
            onDrop={(event) => handleDivisionDrop(parentId, divide, primary, event)}
          />
        ),
      });
    }

    const borderLines = borderSegments.map((segment, index) => (
      <line
        key={`division-border-${parentId}-${index}`}
        x1={segment.x1}
        y1={segment.y1}
        x2={segment.x2}
        y2={segment.y2}
        stroke="var(--kbrd-border-color)"
        strokeWidth={1}
        strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
        style={{ pointerEvents: "none" }}
      />
    ));

    return [
      ...borderLines,
      ...items.filter((item) => !item.priority).map((item) => item.element),
      ...items.filter((item) => item.priority).map((item) => item.element),
    ];
  }

  return (
    <Box
      ref={viewportRef}
      w="100%"
      h="100%"
      p={PADDING}
      style={{
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {display && (
        <svg
          ref={svgRef}
          className="factory-display"
          aria-label="Display"
          width={display.width}
          height={display.height}
          viewBox={`0 0 ${physicalWidthMm} ${physicalHeightMm}`}
          // Any click that isn't on a cell — including the frame itself —
          // bubbles up here and selects the display instead; cells stop
          // their own click from reaching this (see `handleClick`).
          onClick={onSelectDisplay}
          onContextMenu={handleDisplayContextMenu}
          style={{ flexShrink: 0, cursor: "pointer" }}
        >
          <rect
            x={0}
            y={0}
            width={physicalWidthMm}
            height={physicalHeightMm}
            fill="transparent"
            stroke={isDisplaySelected ? DISPLAY_SELECTED_STROKE : "var(--kbrd-border-alt)"}
            strokeWidth={isDisplaySelected ? 2 : 1}
            vectorEffect="non-scaling-stroke"
          />
          {physicalWidthMm > 0 && itemsY > 0 && (
            <g transform={`translate(${gridOffsetX}, ${gridOffsetY})`}>
              {rows.map((cellIds, row) => {
                const slots = layoutRow(cellIds, cells, unitMm, gapMm);
                const cellItems = slots.map((slot) => {
                  const group = groupOf(slot.id, mergeGroups);
                  const primary = Math.min(...group);
                  // A merged cell only renders once, from its primary —
                  // its other members are covered by the merge's own shape.
                  if (primary !== slot.id) return null;

                  const cell = cells[primary];
                  // A cell always gets a `typeId` the instant it's
                  // created (dropping a Layout plugin is what creates it
                  // in the first place) — except a cell that used to be
                  // divided, all of whose divisions were merged back
                  // into one that happened to still be blank (see
                  // `App`'s `mergeDivisionWith`): render that one exactly
                  // like the row's own trailing empty space, no text and
                  // staying dashed even once selected, rather than
                  // showing a stray size label on a cell with nothing
                  // really assigned to it.
                  const hasContent = Boolean(cell?.typeId);
                  const merged =
                    group.length > 1
                      ? mergedOutline(group, rows, cells, unitMm, gapMm)
                      : null;
                  const bounds = merged?.bounds ?? {
                    x: slot.x,
                    y: row * rowPitch,
                    width: slot.width,
                    height: unitMm,
                  };

                  // Only a single, unmerged cell has one well-defined right
                  // edge to drag — a merge's shape (and its Unit) comes
                  // from all of its members together. Queued for its own
                  // pass below rather than rendered here — see
                  // `pendingGrips` — and skipped entirely while "Resize" is
                  // off, so there's nothing to show *or* drag.
                  if (resizeEnabled && group.length === 1 && cell) {
                    pendingGrips.push({ id: primary, bounds, unit: cell.unit });
                  }

                  // A divided (and, by construction, still unmerged at
                  // the top level — see `GridCell.divide`) cell renders
                  // its own division grid instead of one plain shape; the
                  // resize grip above still targets its own outer `unit`.
                  if (group.length === 1 && cell?.divide) {
                    return renderDivisions(primary, cell.divide, bounds, cell.unit);
                  }

                  return (
                    <LayoutItem
                      key={primary}
                      bounds={bounds}
                      path={merged?.path}
                      labelBounds={merged?.labelBounds}
                      typeId={cell?.typeId}
                      pluginIds={cell?.pluginIds}
                      unit={hasContent ? cell?.unit : undefined}
                      isEmpty={!hasContent}
                      isSelected={selectedCellIndices.includes(primary)}
                      isDropTarget={
                        dropTarget?.kind === "cell" &&
                        dropTarget.id === primary
                      }
                      onClick={(event) => handleClick(event, primary)}
                      onContextMenu={(event) => handleCellContextMenu(primary, event)}
                      onDragOver={(event) => handleCellDragOver(primary, event)}
                      onDragLeave={() =>
                        handleDragLeave({ kind: "cell", id: primary })
                      }
                      onDrop={(event) => handleCellDrop(primary, event)}
                      // Only a single, unmerged cell has one well-defined
                      // place to drag *from* — same restriction the
                      // resize grip already has (see `pendingGrips`
                      // above) — and only in Layout mode, where the
                      // row/cell structure this actually changes is
                      // being edited in the first place.
                      onPointerDown={
                        mode === "layout" && group.length === 1
                          ? (event) => handleCellPointerDown(primary, event)
                          : undefined
                      }
                    />
                  );
                });

                const remaining = remainingUnitsInRow(
                  row,
                  rows,
                  cells,
                  physicalWidthMm,
                  unitMm,
                  gapMm,
                );
                if (remaining <= 0) return cellItems;

                const last = slots[slots.length - 1];
                // An empty row's drop zone picks up right where the last
                // real cell left off — or at the row's own flush origin
                // (see `layoutRow`) if there isn't one yet.
                const emptyX = last ? last.x + last.width + gapMm : 0;
                // Reaches all the way to the row's reference right edge
                // (`referenceRowWidthMm`, the same footprint `gridOffsetX`
                // centers), not just `remaining * unitMm` — a lone big
                // cell's Unit budget doesn't spend the gaps a full row of
                // 1U cells would have, so stopping at the raw Unit width
                // alone would leave the drop zone short of the physical
                // edge and the whole row looking off-center.
                const emptyWidth = Math.max(referenceRowWidthMm - emptyX, 0);
                return [
                  ...cellItems,
                  <LayoutItem
                    key={`row-${row}-empty`}
                    bounds={{
                      x: emptyX,
                      y: row * rowPitch,
                      width: emptyWidth,
                      height: unitMm,
                    }}
                    isEmpty
                    isSelected={selectedEmptyRow === row}
                    isDropTarget={
                      dropTarget?.kind === "row" && dropTarget.row === row
                    }
                    onClick={(event) => handleEmptyClick(row, event)}
                    onContextMenu={(event) => handleEmptyContextMenu(row, event)}
                    onDragOver={(event) => handleRowDragOver(row, event)}
                    onDragLeave={() =>
                      handleDragLeave({ kind: "row", row })
                    }
                    onDrop={(event) => handleRowDrop(row, event)}
                  />,
                ];
              })}
              {pendingGrips.map((grip) => (
                <ResizeGrip
                  key={grip.id}
                  bounds={grip.bounds}
                  pxPerMm={pxPerMm}
                  onResizeStart={(event) =>
                    handleResizeStart(grip.id, grip.unit, event)
                  }
                />
              ))}
              {moveDropTarget && (
                <line
                  x1={moveDropTarget.xMm}
                  x2={moveDropTarget.xMm}
                  y1={moveDropTarget.row * rowPitch}
                  y2={moveDropTarget.row * rowPitch + unitMm}
                  stroke="#00ff00"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: "none" }}
                />
              )}
            </g>
          )}
        </svg>
      )}
    </Box>
  );
}
