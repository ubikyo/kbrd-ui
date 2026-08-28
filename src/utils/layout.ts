import type { GridCell, LayoutData } from "../types/layout";

export function defaultLayout(items: LayoutData[]) {
  return items.find((item) => item.name.toLowerCase() === "default") ?? items[0];
}

/** Centre-to-centre spacing between two adjacent items. */
export function pitchMm(unitMm: number, gapMm: number) {
  return unitMm + gapMm;
}

/**
 * How many `unitMm`-sized items fit along `physicalMm`, spaced `gapMm`
 * apart. `n` items take `n * unitMm + (n - 1) * gapMm` — solving for the
 * largest `n` that still fits gives `floor((physicalMm + gapMm) / pitch)`.
 */
export function maxItems(physicalMm: number, unitMm: number, gapMm: number) {
  const pitch = pitchMm(unitMm, gapMm);
  if (pitch <= 0 || physicalMm <= 0) return 0;
  return Math.max(0, Math.floor((physicalMm + gapMm) / pitch));
}

export function rowColOf(index: number, itemsX: number) {
  return { row: Math.floor(index / itemsX), col: index % itemsX };
}

/** Top-left corner of a grid slot, on the uniform 1U-pitch grid every
 * cell's origin sits on regardless of its own size. */
export function cellOriginMm(
  index: number,
  itemsX: number,
  unitMm: number,
  gapMm: number,
) {
  const pitch = pitchMm(unitMm, gapMm);
  const { row, col } = rowColOf(index, itemsX);
  return { x: col * pitch, y: row * pitch, row, col };
}

/**
 * A cell's rendered footprint. Spanning `colspan`/`rowspan` slots merges
 * them into one, so the internal gaps between the merged slots disappear:
 * a 1U key with `colspan: 2` is `2 * unit + 1 * gap` wide, not `2 * unit +
 * 2 * gap`. Width scales with the cell's own Unit (a keycap-size concept);
 * height always uses the board's base Unit, since multi-row spans (Enter,
 * numpad +/Enter) don't change a key's height per row.
 */
export function cellSizeMm(cell: GridCell, unitMm: number, gapMm: number) {
  const width = cell.colspan * (cell.unit * unitMm) + (cell.colspan - 1) * gapMm;
  const height = cell.rowspan * unitMm + (cell.rowspan - 1) * gapMm;
  return { width, height };
}

/**
 * Every grid index covered by some cell's colspan/rowspan besides its own
 * origin, mapped to that origin's index. Covered slots don't get their own
 * independent cell — they're absorbed into the origin's larger shape.
 */
export function occupiedCells(
  cells: Record<number, GridCell>,
  itemsX: number,
  itemsY: number,
) {
  const occupiedBy = new Map<number, number>();
  for (const [key, cell] of Object.entries(cells)) {
    const origin = Number(key);
    const { row, col } = rowColOf(origin, itemsX);
    for (let dr = 0; dr < cell.rowspan; dr++) {
      for (let dc = 0; dc < cell.colspan; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (r >= itemsY || c >= itemsX) continue;
        occupiedBy.set(r * itemsX + c, origin);
      }
    }
  }
  return occupiedBy;
}
