import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { GridCell } from "../types/layout";
import { layoutRow } from "../utils/layout";
import type { ElementSize } from "./useElementSize";

// A pointer has to travel at least this far (in screen px) before a
// pointer-down on a cell counts as dragging it to move it, rather than
// just being the press half of an ordinary click — see
// `handleCellPointerDown`.
const MOVE_THRESHOLD_PX = 4;

// Where a dragged cell would land if dropped right now — the green
// insertion line's own position (`xMm`, spanning `row`'s own height) and
// which existing cell (if any) it would insert before, for `onMoveCell`.
// `beforeId: null` means the row's own end (including a fully empty row).
export type MoveDropTarget = {
  row: number;
  beforeId: number | null;
  xMm: number;
};

/**
 * Dragging a cell to move it — plain pointer events (`pointerdown` on the
 * cell itself, `pointermove`/`pointerup` on the window) rather than
 * native HTML5 drag-and-drop, which SVG elements support too
 * inconsistently across browsers (Chromium in particular) to rely on for
 * this — the exact same reason `useCellResize`'s own grip is built the
 * same way.
 */
export function useCellMove(params: {
  rows: number[][];
  cells: Record<number, GridCell>;
  unitMm: number;
  gapMm: number;
  display: ElementSize | null;
  pxPerMm: number;
  gridOffsetX: number;
  gridOffsetY: number;
  itemsY: number;
  rowPitch: number;
  onMoveCell: (id: number, targetRow: number, beforeId: number | null) => void;
}) {
  const {
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
  } = params;

  const svgRef = useRef<SVGSVGElement>(null);
  // Where a cell currently being dragged (see `handleCellPointerDown`)
  // would land if dropped right now — drawn as a green insertion line.
  const [moveDropTarget, setMoveDropTarget] = useState<MoveDropTarget | null>(
    null,
  );
  // Mirrors `moveDropTarget`, read from the window `pointerup` handler
  // below instead of the state itself so that effect doesn't need to
  // re-subscribe on every single pointer move during a drag
  // (`moveDropTarget` changes continuously; this ref doesn't need to
  // trigger a render).
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
  // was just dragged — read and cleared by `Factory`'s own `handleClick`.
  const suppressClickRef = useRef(false);

  useEffect(() => {
    // Where a cell dragged from `row` (its own current row, `excludeId` —
    // it doesn't insert relative to itself) would land, given its own
    // cursor position converted to this row's local mm-space (`xMm`):
    // whichever existing cell's own midpoint the cursor hasn't yet
    // reached is where it lands, or the row's end if it's past all of
    // them.
    function findInsertionPoint(
      row: number,
      xMm: number,
      excludeId: number,
    ): MoveDropTarget {
      const cellIds = (rows[row] ?? []).filter((id) => id !== excludeId);
      const slots = layoutRow(cellIds, cells, unitMm, gapMm);
      for (const slot of slots) {
        if (xMm < slot.x + slot.width / 2) {
          return { row, beforeId: slot.id, xMm: slot.x };
        }
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
  }, [
    display,
    pxPerMm,
    gridOffsetX,
    gridOffsetY,
    itemsY,
    rowPitch,
    rows,
    cells,
    unitMm,
    gapMm,
    onMoveCell,
  ]);

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

  // Shared with `Factory`'s own native-DnD drop-target clearing (see its
  // `dragend`/`drop` window listeners) — a drag ending any way at all
  // should never leave a stale insertion line on screen.
  function clearMoveDropTarget() {
    setMoveTarget(null);
  }

  return {
    svgRef,
    moveDropTarget,
    suppressClickRef,
    handleCellPointerDown,
    clearMoveDropTarget,
  };
}
