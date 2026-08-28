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
 * cell's origin sits on regardless of its own size. Only `y` still matches
 * how `<Factory>` actually renders a row — `x` assumes every earlier column
 * is exactly 1U wide, which `layoutRow` no longer does. */
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

/** One rendered slot in a row laid out by `layoutRow`. */
export type RowSlot = {
  index: number;
  // True for the row's trailing, unassigned remainder — not a real placed
  // cell yet, just wherever a new one would land next.
  isFiller: boolean;
  x: number;
  width: number;
};

/**
 * Lays a row out left to right as an actual flow, not a grid of fixed 1U
 * slots: each cell sits right after the previous one's edge plus `gapMm`,
 * so a 1.25U key really is 1.25U wide and everything after it shifts over
 * — it doesn't overflow into a neighbour's slot or leave one squeezed.
 *
 * Only cells that already exist in `cells` are placed, in column order;
 * the loop stops at the first column nothing has been dropped on yet, so
 * `1U, 1U, …` doesn't need every one of `itemsX` columns filled in one by
 * one. Whatever Unit budget is left over (`itemsX` minus the sum of
 * `colspan * unit` for every placed cell) becomes a single trailing filler
 * slot sized to that remainder, ready for the next drop — this is what
 * keeps every row at the same overall Unit budget regardless of how it's
 * actually split up (e.g. 9U as nine 1U keys, or as 2.75U + six 1U + a
 * 0.25U remainder).
 */
export function layoutRow(
  row: number,
  itemsX: number,
  cells: Record<number, GridCell>,
  occupied: ReadonlyMap<number, number>,
  unitMm: number,
  gapMm: number,
): RowSlot[] {
  const slots: RowSlot[] = [];
  let usedUnits = 0;
  let x = 0;
  let nextCol = 0;

  for (let col = 0; col < itemsX; col++) {
    const index = row * itemsX + col;
    if (occupied.has(index)) {
      nextCol = col + 1;
      continue;
    }
    const cell = cells[index];
    if (!cell) break; // first not-yet-placed column: the rest is the remainder

    const { width } = cellSizeMm(cell, unitMm, gapMm);
    if (slots.length > 0) x += gapMm;
    slots.push({ index, isFiller: false, x, width });
    x += width;
    usedUnits += cell.colspan * cell.unit;
    nextCol = col + 1;
  }

  const remaining = itemsX - usedUnits;
  if (remaining > 1e-9 && nextCol < itemsX) {
    if (slots.length > 0) x += gapMm;
    slots.push({
      index: row * itemsX + nextCol,
      isFiller: true,
      x,
      width: remaining * unitMm,
    });
  }

  return slots;
}
