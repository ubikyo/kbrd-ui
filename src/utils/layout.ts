import { defaultGridCell, type GridCell, type LayoutData } from "../types/layout";

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

/** Reference footprint of `items` 1U slots laid out with `gapMm` between
 * them — the same total width/height `maxItems` fits within `physicalMm`.
 * The fixed target every row (or the whole grid) is centered/closed to. */
export function gridSizeMm(items: number, unitMm: number, gapMm: number) {
  return items > 0 ? items * unitMm + (items - 1) * gapMm : 0;
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
  // True when this slot's width isn't its own Unit: it's forced to
  // whatever's left of the row's Unit budget once every earlier slot in
  // the row is accounted for, and can't be set independently.
  isRemainder: boolean;
  x: number;
  width: number;
};

/**
 * Lays a row out left to right as an actual flow, not a grid of fixed 1U
 * slots: each cell sits right after the previous one's edge plus `gapMm`,
 * so a 1.25U key really is 1.25U wide and everything after it shifts over
 * — it doesn't overflow into a neighbour's slot or leave one squeezed.
 *
 * Every column defaults to a plain 1U cell until something's actually
 * dropped on it, so an untouched row still renders as `itemsX` individual
 * slots rather than one big blank rectangle. Walking left to right, the
 * first column whose own Unit would meet or exceed what's left of the
 * row's budget becomes that row's remainder: its width is clamped to
 * exactly what's left (not its configured Unit) and no further columns
 * are laid out — there's nothing left to give them. This is what makes
 * `1.25U, 1.25U, six 1U` end in a 0.5U remainder at column 8, while
 * `2.75U, six 1U` ends in a 0.25U remainder at column 7 (one column
 * short, since the wider first key ate into the budget faster).
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
  let x = 0;
  let usedUnits = 0;

  for (let col = 0; col < itemsX; col++) {
    const index = row * itemsX + col;
    if (occupied.has(index)) continue;

    const cell = cells[index] ?? defaultGridCell();
    const footprint = cell.colspan * cell.unit;
    const remainingUnits = itemsX - usedUnits;
    const isRemainder = footprint >= remainingUnits - 1e-9;
    const width = isRemainder
      ? remainingUnits * unitMm
      : cellSizeMm(cell, unitMm, gapMm).width;

    if (slots.length > 0) x += gapMm;
    slots.push({ index, isRemainder, x, width });
    x += width;
    usedUnits += isRemainder ? remainingUnits : footprint;

    if (isRemainder) break; // nothing left for any column after this one
  }

  return slots;
}
