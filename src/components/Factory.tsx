import { Box } from "@mantine/core";
import { useEffect, useState } from "react";
import type { DragEvent, MouseEvent as ReactMouseEvent } from "react";

import { FALLBACK_HEIGHT, FALLBACK_WIDTH } from "../api/device";
import { useCellMove } from "../classes/useCellMove";
import { useCellResize } from "../classes/useCellResize";
import { useDevicePolling } from "../classes/useDevicePolling";
import { useElementSize } from "../classes/useElementSize";
import { isMappingTarget, isMappingVisible, pluginById } from "../plugins/registry";
import {
  defaultDivisionCell,
  defaultGridCell,
  MIN_UNIT,
  type DivideGrid,
  type GridCell,
  type LayoutSettings,
  type MergeGroups,
} from "../types/layout";
import {
  gridSizeMm,
  groupOf,
  layoutRow,
  maxItems,
  mergedOutline,
  pitchMm,
  primaryOf,
  remainingUnitsInRow,
  type CellRect,
} from "../utils/layout";
import DivisionGrid from "./DivisionGrid";
import LayoutItem, { ResizeGrip } from "./LayoutItem";

const PADDING = 60;
const PLUGIN_DRAG_TYPE = "application/kbrd-plugin";
// Same green `LayoutItem` uses for a selected cell.
const DISPLAY_SELECTED_STROKE = "#00ff00";

// What's currently under the drag cursor: an existing cell, a row's
// trailing empty space (see `remainingUnitsInRow`) — there's no "default
// cell" to drop onto until one of these creates one — or a division of a
// divided cell (see `GridCell.divide`).
type DropTarget =
  | { kind: "cell"; id: number }
  | { kind: "row"; row: number }
  | { kind: "division"; parentId: number; subId: number };

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
  const { ref: viewportRef, size: viewport } = useElementSize<HTMLDivElement>();
  const device = useDevicePolling();
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

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

  const { handleResizeStart } = useCellResize({
    rows,
    cells,
    physicalWidthMm,
    unitMm,
    gapMm,
    display,
    pxPerMm,
    onCellsChange,
  });

  const cellMove = useCellMove({
    rows,
    cells,
    unitMm,
    gapMm,
    display,
    pxPerMm,
    gridOffsetX,
    gridOffsetY,
    itemsY,
    rowPitch,
    onMoveCell,
  });
  const {
    svgRef,
    moveDropTarget,
    suppressClickRef,
    handleCellPointerDown,
  } = cellMove;

  // A native HTML5 drag ending any way at all (dropped, or cancelled with
  // Escape) must never leave a stale drop-target highlight behind — the
  // element it was over doesn't always get its own `dragleave` first.
  useEffect(() => {
    const clearDropTarget = () => {
      setDropTarget(null);
      cellMove.clearMoveDropTarget();
    };
    window.addEventListener("dragend", clearDropTarget);
    window.addEventListener("drop", clearDropTarget);
    return () => {
      window.removeEventListener("dragend", clearDropTarget);
      window.removeEventListener("drop", clearDropTarget);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      !isMappingTarget(cell?.typeId) ||
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
      !isMappingTarget(divCell?.typeId) ||
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
                  // off (Layout mode only: Mapping mode hides the switch
                  // and never shows a grip regardless of what it was left
                  // at), so there's nothing to show *or* drag.
                  if (mode === "layout" && resizeEnabled && group.length === 1 && cell) {
                    pendingGrips.push({ id: primary, bounds, unit: cell.unit });
                  }

                  // A divided (and, by construction, still unmerged at
                  // the top level — see `GridCell.divide`) cell renders
                  // its own division grid instead of one plain shape; the
                  // resize grip above still targets its own outer `unit`.
                  if (group.length === 1 && cell?.divide) {
                    return (
                      <DivisionGrid
                        key={primary}
                        mode={mode}
                        parentId={primary}
                        divide={cell.divide}
                        parentRect={bounds}
                        parentUnit={cell.unit}
                        selectedCellIndices={selectedCellIndices}
                        selectedDivisionIndices={selectedDivisionIndices}
                        isDropTarget={(subId) =>
                          dropTarget?.kind === "division" &&
                          dropTarget.parentId === primary &&
                          dropTarget.subId === subId
                        }
                        onDivisionClick={handleDivisionClick}
                        onDivisionContextMenu={handleDivisionContextMenu}
                        onDivisionDragOver={handleDivisionDragOver}
                        onDivisionDragLeave={(parentId, subId) =>
                          handleDragLeave({ kind: "division", parentId, subId })
                        }
                        onDivisionDrop={handleDivisionDrop}
                      />
                    );
                  }

                  // Mapping mode only ever shows a cell whose own Layout
                  // plugin opts into it (`mapping-visible` — Key does,
                  // Space doesn't) — an invisible one still keeps its row
                  // slot (nothing here changes `layoutRow`'s own math),
                  // just nothing renders there: no shape, no text, and
                  // (having no element at all) no longer clickable either.
                  if (mode !== "layout" && !isMappingVisible(cell?.typeId)) {
                    return null;
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
                      // Layout-only: Mapping mode shows the shape (once
                      // `mapping-visible`) with no size/type caption under
                      // it — see `LayoutItem`'s own `showText`.
                      showText={mode === "layout"}
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
                // A row's own trailing empty space (its dashed drop
                // target) is a Layout-only concept — there's nothing to
                // drop there in Mapping mode, and the row itself isn't a
                // selectable target either.
                if (mode !== "layout" || remaining <= 0) return cellItems;

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
