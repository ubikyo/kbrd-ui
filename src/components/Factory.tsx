import { Box } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type {
  DragEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import {
  FALLBACK_HEIGHT,
  FALLBACK_WIDTH,
  getDevice,
  type DeviceStatus,
} from "../api/device";
import { pluginById } from "../plugins/registry";
import {
  defaultGridCell,
  MIN_UNIT,
  UNIT_STEP,
  type GridCell,
  type LayoutSettings,
  type MergeGroups,
} from "../types/layout";
import {
  cellRect,
  cellSizeMm,
  gridSizeMm,
  groupOf,
  groupsShareEdge,
  layoutRow,
  maxItems,
  maxUnitForCell,
  mergedOutline,
  pitchMm,
  primaryOf,
  remainingUnitsInRow,
  shareEdge,
  type CellRect,
} from "../utils/layout";
import LayoutItem, { ResizeGrip } from "./LayoutItem";

const PADDING = 60;
const POLL_INTERVAL_MS = 5000;
const LAYOUT_KEY_PLUGIN_ID = "kbrd.layout-key";
const PLUGIN_DRAG_TYPE = "application/kbrd-plugin";
// Same green `LayoutItem` uses for a selected cell.
const BOARD_SELECTED_STROKE = "#00ff00";

type Size = {
  width: number;
  height: number;
};

// What's currently under the drag cursor: an existing cell, or a row's
// trailing empty space (see `remainingUnitsInRow`) — there's no "default
// cell" to drop onto until one of these creates one.
type DropTarget = { kind: "cell"; id: number } | { kind: "row"; row: number };

type Props = LayoutSettings & {
  mode: "layout" | "mapping";
  // The board's full grid — see `gridRows`. A row starts with no cells at
  // all; `App` owns the actual list.
  rows: number[][];
  cells: Record<number, GridCell>;
  onCellsChange: (
    update: (current: Record<number, GridCell>) => Record<number, GridCell>,
  ) => void;
  // Drops a freshly-typed cell onto the end of `row`'s empty space —
  // dropping a Layout plugin where there's no cell yet.
  onCreateCell: (row: number, cell: GridCell) => void;
  mergeGroups: MergeGroups;
  selectedCellIndex: number | null;
  onSelectCell: (index: number | null) => void;
  // The cell "Merge" was invoked from, if a merge is in progress — see
  // `LayoutCellProperties`'s Actions menu and `App`'s Notification/STOP.
  mergeSourceIndex: number | null;
  onMergeWith: (target: number) => void;
  // A row's trailing empty space (or a fully empty row), selected instead
  // of a real cell — mutually exclusive with `selectedCellIndex`. Lets a
  // copied plugin be pasted straight into space nothing has claimed yet.
  selectedEmptyRow: number | null;
  onSelectEmpty: (row: number) => void;
  // While a merge is in progress, clicking `row`'s empty space instead of
  // a cell grows the merge into it — a brand-new, plugin-less cell is
  // created there and merged in, rather than requiring one be typed first.
  onMergeWithEmpty: (row: number) => void;
  // The physical screen itself (the white outline) selected as its own
  // target — mutually exclusive with a cell — for `App`'s Layout/Layer
  // Actions menu (Add/Edit/Delete), the same way selecting a cell shows
  // its own Actions menu.
  isBoardSelected: boolean;
  onSelectBoard: () => void;
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
  mergeGroups,
  selectedCellIndex,
  onSelectCell,
  mergeSourceIndex,
  onMergeWith,
  selectedEmptyRow,
  onSelectEmpty,
  onMergeWithEmpty,
  isBoardSelected,
  onSelectBoard,
  resizeEnabled,
  maxColumns,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [device, setDevice] = useState<DeviceStatus>({ connected: false });
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
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
    const clearDropTarget = () => setDropTarget(null);
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

  function handleCellDragOver(id: number, event: DragEvent<SVGGElement>) {
    if (!event.dataTransfer.types.includes(PLUGIN_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropTarget({ kind: "cell", id });
  }

  function handleDragLeave(target: DropTarget) {
    setDropTarget((current) =>
      current?.kind === target.kind &&
      (target.kind === "cell"
        ? current.kind === "cell" && current.id === target.id
        : target.kind === "row" &&
          current.kind === "row" &&
          current.row === target.row)
        ? null
        : current,
    );
  }

  function handleClick(event: ReactMouseEvent<SVGGElement>, index: number) {
    // A cell click is never also a click on the board behind it — see
    // `handleSelectBoard`, bound on the `<svg>` itself.
    event.stopPropagation();
    const primary = primaryOf(index, mergeGroups);
    if (mergeSourceIndex !== null) {
      if (primary === primaryOf(mergeSourceIndex, mergeGroups)) return;
      if (
        groupsShareEdge(
          groupOf(mergeSourceIndex, mergeGroups),
          groupOf(primary, mergeGroups),
          rows,
          cells,
          unitMm,
          gapMm,
        )
      ) {
        onMergeWith(primary);
      }
      return;
    }
    onSelectCell(selectedCellIndex === primary ? null : primary);
  }

  // The rect a brand-new cell would occupy if `row`'s empty space were
  // used right now — the same spot and up-to-1U size `handleRowDrop`
  // gives a dropped Layout plugin — used to test whether merging into it
  // would actually reach `mergeSourceIndex`'s group.
  function pendingCellRect(row: number): CellRect | null {
    const remaining = remainingUnitsInRow(
      row,
      rows,
      cells,
      physicalWidthMm,
      unitMm,
      gapMm,
    );
    if (remaining < MIN_UNIT) return null;
    const slots = layoutRow(rows[row] ?? [], cells, unitMm, gapMm);
    const last = slots[slots.length - 1];
    const x = last ? last.x + last.width + gapMm : 0;
    const { width } = cellSizeMm(
      defaultGridCell(Math.min(1, remaining)),
      unitMm,
      gapMm,
    );
    return { x, y: row * rowPitch, width, height: unitMm };
  }

  function handleEmptyClick(
    row: number,
    event: ReactMouseEvent<SVGGElement>,
  ) {
    // Same as `handleClick` — never also a click on the board behind it.
    event.stopPropagation();
    if (mergeSourceIndex !== null) {
      const targetRect = pendingCellRect(row);
      if (!targetRect) return;
      const sourceRects = groupOf(mergeSourceIndex, mergeGroups).map((id) =>
        cellRect(id, rows, cells, unitMm, gapMm),
      );
      if (sourceRects.some((rect) => shareEdge(rect, targetRect, gapMm))) {
        onMergeWithEmpty(row);
      }
      return;
    }
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
          className="factory-display"
          aria-label="Display"
          width={display.width}
          height={display.height}
          viewBox={`0 0 ${physicalWidthMm} ${physicalHeightMm}`}
          // Any click that isn't on a cell — including the frame itself —
          // bubbles up here and selects the board instead; cells stop
          // their own click from reaching this (see `handleClick`).
          onClick={onSelectBoard}
          style={{ flexShrink: 0, cursor: "pointer" }}
        >
          <rect
            x={0}
            y={0}
            width={physicalWidthMm}
            height={physicalHeightMm}
            fill="transparent"
            stroke={isBoardSelected ? BOARD_SELECTED_STROKE : "var(--kbrd-border-alt)"}
            strokeWidth={isBoardSelected ? 2 : 1}
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

                  return (
                    <LayoutItem
                      key={primary}
                      bounds={bounds}
                      path={merged?.path}
                      typeId={cell?.typeId}
                      pluginIds={cell?.pluginIds}
                      unit={cell?.unit}
                      isSelected={selectedCellIndex === primary}
                      isDropTarget={
                        dropTarget?.kind === "cell" &&
                        dropTarget.id === primary
                      }
                      onClick={(event) => handleClick(event, primary)}
                      onDragOver={(event) => handleCellDragOver(primary, event)}
                      onDragLeave={() =>
                        handleDragLeave({ kind: "cell", id: primary })
                      }
                      onDrop={(event) => handleCellDrop(primary, event)}
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
            </g>
          )}
        </svg>
      )}
    </Box>
  );
}
