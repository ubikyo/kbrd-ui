import { useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { MIN_UNIT, UNIT_STEP, type GridCell } from "../types/layout";
import { maxUnitForCell, pitchMm } from "../utils/layout";
import type { ElementSize } from "./useElementSize";

/**
 * Drag-resizing a cell from its right-edge handle (`<ResizeGrip>`, see
 * `LayoutItem`) — pixels moved on screen convert to mm via the SVG's own
 * scale (`pxPerMm`), then to Units, snapped to `UNIT_STEP` and capped by
 * `maxUnitForCell` so it can never outgrow its row's budget. A cell's
 * width grows by one whole *pitch* per +1 Unit (see `cellSizeMm`), not by
 * `unitMm` (its cap size) alone.
 */
export function useCellResize(params: {
  rows: number[][];
  cells: Record<number, GridCell>;
  physicalWidthMm: number;
  unitMm: number;
  gapMm: number;
  display: ElementSize | null;
  pxPerMm: number;
  onCellsChange: (
    update: (current: Record<number, GridCell>) => Record<number, GridCell>,
  ) => void;
}) {
  const { rows, cells, physicalWidthMm, unitMm, gapMm, display, pxPerMm, onCellsChange } =
    params;

  // `startUnit` is the cell's Unit *before* the drag started, so every
  // pointer move recomputes the new Unit from that same fixed baseline
  // rather than compounding deltas.
  const [resizing, setResizing] = useState<{
    id: number;
    startClientX: number;
    startUnit: number;
  } | null>(null);

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

  return { handleResizeStart };
}
