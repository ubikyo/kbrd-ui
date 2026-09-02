import {
  defaultGridCell,
  type GridCell,
  type LayoutData,
  type MergeGroups,
} from "../types/layout";

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

/** Reference footprint of `items` 1U slots laid out with `gapMm` between
 * them — the same total width/height `maxItems` fits within `physicalMm`.
 * Used to center the board's rows within the physical display, both
 * vertically (its row count) and horizontally (its column count) — see
 * `gridOffsetY`/`gridOffsetX` in `Factory`. */
export function gridSizeMm(items: number, unitMm: number, gapMm: number) {
  return items > 0 ? items * unitMm + (items - 1) * gapMm : 0;
}

/**
 * A cell's own physical footprint. `unitMm` is a keycap's own size (not
 * its pitch — the space between two keycaps' centres is `unitMm + gapMm`,
 * see `pitchMm`): a plain 1U key is `unitMm` wide, but a wider one spanning
 * `cell.unit` pitches isn't simply `cell.unit * unitMm` — it eats that
 * many pitches of row space, plastic and gap alike, except for the one
 * trailing gap it doesn't need past its own last pitch. Height is always
 * the board's base cap size (a row's height doesn't depend on Unit).
 */
export function cellSizeMm(cell: GridCell, unitMm: number, gapMm: number) {
  return {
    width: cell.unit * pitchMm(unitMm, gapMm) - gapMm,
    height: unitMm,
  };
}

/**
 * The board's full grid: `itemsY` rows, each an ordered list of cell ids
 * — empty until a plugin is actually dropped on that row (there is no
 * "default cell"; see `GridCell`'s docstring). `rowOverrides` holds
 * whatever rows have at least one cell.
 */
export function gridRows(
  itemsY: number,
  rowOverrides: Record<number, number[]>,
): number[][] {
  return Array.from({ length: itemsY }, (_, row) => rowOverrides[row] ?? []);
}

/** Which row of `rows` holds cell `id`, or -1 if none does. */
export function rowOf(id: number, rows: number[][]): number {
  return rows.findIndex((cellIds) => cellIds.includes(id));
}

/** A fresh id guaranteed not to collide with any id already in `rows`. */
export function nextCellId(rows: number[][]): number {
  return 1 + rows.reduce((max, cellIds) => Math.max(max, ...cellIds, -1), -1);
}

/** Appends a fresh cell to the end of `row` — dropping a Layout plugin on
 * a row's empty space. Returns both the updated grid and the new cell's
 * id, so the caller can give that id a real `GridCell` (its plugin type)
 * in the same stroke. */
export function addCellToRow(
  rows: number[][],
  row: number,
): { rows: number[][]; id: number } {
  const id = nextCellId(rows);
  return {
    rows: rows.map((cellIds, r) => (r === row ? [...cellIds, id] : cellIds)),
    id,
  };
}

/** Inserts a fresh cell into `row` right after `afterId` — "Paste" in the
 * Actions menu, landing next to the cell it was invoked from rather than
 * at the row's end (see `addCellToRow` for that). Falls back to the row's
 * end if `afterId` isn't actually in it. Returns both the updated grid
 * and the new cell's id, so the caller can give it a real `GridCell` in
 * the same stroke. */
export function insertCellAfter(
  rows: number[][],
  row: number,
  afterId: number,
): { rows: number[][]; id: number } {
  const id = nextCellId(rows);
  return {
    rows: rows.map((cellIds, r) => {
      if (r !== row) return cellIds;
      const at = cellIds.indexOf(afterId);
      if (at === -1) return [...cellIds, id];
      return [...cellIds.slice(0, at + 1), id, ...cellIds.slice(at + 1)];
    }),
    id,
  };
}

/** Whether `id` could be removed from the row it's in — a merged cell has
 * to be unmerged first, since removing one member out from under a merge
 * would leave the others pointing at a group member that no longer
 * exists. Unlike a cell's Unit, a row's cell *count* has no floor: a row
 * can go all the way back down to empty. */
export function canRemoveCell(
  id: number,
  rows: number[][],
  mergeGroups: MergeGroups,
): boolean {
  const row = rowOf(id, rows);
  if (row === -1) return false;
  return groupOf(id, mergeGroups).length === 1;
}

/** Removes `id` from `row`'s cell list — the inverse of `addCellToRow`. */
export function removeCellFromRow(
  rows: number[][],
  row: number,
  id: number,
): number[][] {
  return rows.map((cellIds, r) =>
    r === row ? cellIds.filter((cellId) => cellId !== id) : cellIds,
  );
}

/** One rendered slot in a row laid out by `layoutRow`. */
export type RowSlot = {
  id: number;
  x: number;
  width: number;
};

/**
 * Lays a row's actual cells out left to right as a plain flow, starting
 * flush at the row's own local origin (`x = 0`) — a gap only sits
 * *between* two consecutive cells, not before the first or after the
 * last, matching `maxItems`'s own `n * unitMm + (n - 1) * gapMm` budget.
 * Each cell's own physical width comes from `cellSizeMm` (its Unit is a
 * pitch count, not a raw mm scale — see that function), and the next
 * cell sits right after its edge plus one more `gapMm`. Nothing is
 * rescaled or stretched to hit any particular total. Whatever margin the
 * row ends up with on screen comes from centering the whole grid as a
 * block (`gridOffsetX` in `Factory`), not from a margin baked in here. A
 * row with no cells (or fewer/smaller ones than its full Unit budget)
 * simply ends early; see `Factory`'s trailing drop target for the budget
 * it has left (`maxUnitForCell`).
 */
export function layoutRow(
  cellIds: number[],
  cells: Record<number, GridCell>,
  unitMm: number,
  gapMm: number,
): RowSlot[] {
  const slots: RowSlot[] = [];
  let x = 0;

  for (const id of cellIds) {
    const { width } = cellSizeMm(cells[id] ?? defaultGridCell(), unitMm, gapMm);
    if (slots.length > 0) x += gapMm;
    slots.push({ id, x, width });
    x += width;
  }

  return slots;
}

/**
 * A row's total Unit budget: the same flat count `maxItems` gives for the
 * horizontal axis (and shown in Settings as "Max items") — how many 1U
 * items fit across `physicalWidthMm`. That number is the cap on the *sum*
 * of a row's cell Units, however many cells make it up: 1×9U, 18×0.5U,
 * 36×0.25U or any other split that adds up to it are all equally valid.
 * Gaps between cells are rendered (see `layoutRow`) but don't themselves
 * count against this budget.
 */
function rowUnitCapacity(
  physicalWidthMm: number,
  unitMm: number,
  gapMm: number,
): number {
  return maxItems(physicalWidthMm, unitMm, gapMm);
}

/**
 * The largest Unit `id` could take without pushing its row's Unit sum
 * past its flat budget — see `rowUnitCapacity`. Used as the Unit slider's
 * `max` (`LayoutCellProperties`).
 */
export function maxUnitForCell(
  id: number,
  rows: number[][],
  cells: Record<number, GridCell>,
  physicalWidthMm: number,
  unitMm: number,
  gapMm: number,
): number {
  const row = rowOf(id, rows);
  const capacity = rowUnitCapacity(physicalWidthMm, unitMm, gapMm);
  if (row === -1) return capacity;
  const cellIds = rows[row];
  const otherUnits = cellIds.reduce(
    (sum, cellId) =>
      cellId === id ? sum : sum + (cells[cellId] ?? defaultGridCell()).unit,
    0,
  );
  return Math.max(capacity - otherUnits, 0);
}

/** How much Unit budget a row has left for a brand new cell — the width
 * of `Factory`'s trailing "drop a plugin here" zone — see
 * `rowUnitCapacity`. */
export function remainingUnitsInRow(
  row: number,
  rows: number[][],
  cells: Record<number, GridCell>,
  physicalWidthMm: number,
  unitMm: number,
  gapMm: number,
): number {
  const cellIds = rows[row] ?? [];
  const usedUnits = cellIds.reduce(
    (sum, id) => sum + (cells[id] ?? defaultGridCell()).unit,
    0,
  );
  const capacity = rowUnitCapacity(physicalWidthMm, unitMm, gapMm);
  return Math.max(capacity - usedUnits, 0);
}

/** A cell's absolute rectangle: `x`/`width` from its own row's flow,
 * `y`/`height` from the board's fixed row pitch. */
export type CellRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function cellRect(
  id: number,
  rows: number[][],
  cells: Record<number, GridCell>,
  unitMm: number,
  gapMm: number,
): CellRect {
  const row = rowOf(id, rows);
  const slot = layoutRow(rows[row] ?? [], cells, unitMm, gapMm).find(
    (candidate) => candidate.id === id,
  );
  return {
    x: slot?.x ?? 0,
    y: Math.max(row, 0) * pitchMm(unitMm, gapMm),
    width: slot?.width ?? unitMm,
    height: unitMm,
  };
}

/** The merge group `index` belongs to, or the singleton `[index]` if it
 * hasn't been merged with anything. */
export function groupOf(index: number, groups: MergeGroups): number[] {
  return groups.find((group) => group.includes(index)) ?? [index];
}

/** The index whose `GridCell` a merged group is shown and edited through
 * — its smallest member, so it's stable regardless of merge order. */
export function primaryOf(index: number, groups: MergeGroups): number {
  return Math.min(...groupOf(index, groups));
}

/** Merges `a` and `b`'s groups (each possibly already a merge of several
 * cells) into one, replacing both in `groups`. */
export function addMerge(
  groups: MergeGroups,
  a: number,
  b: number,
): MergeGroups {
  const groupA = groupOf(a, groups);
  const groupB = groupOf(b, groups);
  const merged = [...new Set([...groupA, ...groupB])].sort((x, y) => x - y);
  const rest = groups.filter((group) => group !== groupA && group !== groupB);
  return [...rest, merged];
}

/** Undoes `index`'s merge, splitting its group back into standalone cells
 * — the inverse of `addMerge`. A no-op if `index` isn't merged. */
export function removeMerge(groups: MergeGroups, index: number): MergeGroups {
  const group = groupOf(index, groups);
  return groups.filter((candidate) => candidate !== group);
}

/** Two rects "share a common edge" when they sit right against each
 * other — horizontally on the same row, or vertically across the gap
 * between two rows — with some overlap along the touching side. */
export function shareEdge(a: CellRect, b: CellRect, gapMm: number) {
  const eps = 1e-6;
  const horizontallyTouching =
    Math.abs(a.y - b.y) < eps &&
    Math.abs(a.height - b.height) < eps &&
    (Math.abs(a.x + a.width + gapMm - b.x) < eps ||
      Math.abs(b.x + b.width + gapMm - a.x) < eps);
  const verticallyTouching =
    (Math.abs(a.y + a.height + gapMm - b.y) < eps ||
      Math.abs(b.y + b.height + gapMm - a.y) < eps) &&
    a.x < b.x + b.width - eps &&
    b.x < a.x + a.width - eps;
  return horizontallyTouching || verticallyTouching;
}

/** Whether any cell of `groupA` shares a common edge with any cell of
 * `groupB` — the condition for the two groups to be merge-able. */
export function groupsShareEdge(
  groupA: number[],
  groupB: number[],
  rows: number[][],
  cells: Record<number, GridCell>,
  unitMm: number,
  gapMm: number,
) {
  const rectsA = groupA.map((id) => cellRect(id, rows, cells, unitMm, gapMm));
  const rectsB = groupB.map((id) => cellRect(id, rows, cells, unitMm, gapMm));
  return rectsA.some((a) => rectsB.some((b) => shareEdge(a, b, gapMm)));
}

/**
 * The outline of a merged group, as an SVG path — a plain rectangle when
 * every member sits on the same row, a stepped/L shape (an ISO Enter key)
 * when they're stacked across rows with a different width each. Members
 * on the same row are first collapsed into that row's own union rect
 * (their gap between them absorbed).
 *
 * Adjacent rows are then closed up vertically on their own terms, not by
 * splitting the row-to-row gap in half: on each side (left/right), the
 * *narrower* row's edge bridges the entire gap to reach the *wider* row's
 * own, unextended edge — the step always lands on the wider row's true
 * boundary. Only the column range the two rows actually share is ever
 * bridged; a column only one of them occupies keeps its full gap open,
 * so the merge never bleeds into a neighbouring, unmerged cell's own gap.
 */
export function mergedOutline(
  group: number[],
  rows: number[][],
  cells: Record<number, GridCell>,
  unitMm: number,
  gapMm: number,
): { path: string; bounds: CellRect } {
  const byRow = new Map<number, CellRect[]>();
  for (const id of group) {
    const row = rowOf(id, rows);
    const rect = cellRect(id, rows, cells, unitMm, gapMm);
    const existing = byRow.get(row);
    if (existing) existing.push(rect);
    else byRow.set(row, [rect]);
  }

  const sortedRows = [...byRow.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, rects]) => ({
      x: Math.min(...rects.map((r) => r.x)),
      right: Math.max(...rects.map((r) => r.x + r.width)),
      y: rects[0].y,
      bottom: rects[0].y + rects[0].height,
    }));

  const bounds: CellRect = {
    x: Math.min(...sortedRows.map((r) => r.x)),
    y: sortedRows[0].y,
    width:
      Math.max(...sortedRows.map((r) => r.right)) -
      Math.min(...sortedRows.map((r) => r.x)),
    height: sortedRows[sortedRows.length - 1].bottom - sortedRows[0].y,
  };

  if (sortedRows.length === 1) {
    const only = sortedRows[0];
    return {
      path: `M${only.x},${only.y} H${only.right} V${only.bottom} H${only.x} Z`,
      bounds,
    };
  }

  // Right side, top to bottom: whichever row reaches further right keeps
  // its own unextended edge, and the other bridges the full gap to meet
  // it there.
  const right: string[] = [`H${sortedRows[0].right}`];
  for (let i = 0; i < sortedRows.length - 1; i++) {
    const a = sortedRows[i];
    const b = sortedRows[i + 1];
    right.push(a.right >= b.right ? `V${a.bottom}` : `V${b.y}`, `H${b.right}`);
  }
  right.push(`V${sortedRows[sortedRows.length - 1].bottom}`);

  // Left side, bottom to top: same rule, mirrored — whichever row reaches
  // further left keeps its own unextended edge.
  const left: string[] = [`H${sortedRows[sortedRows.length - 1].x}`];
  for (let i = sortedRows.length - 1; i > 0; i--) {
    const a = sortedRows[i];
    const b = sortedRows[i - 1];
    left.push(a.x <= b.x ? `V${a.y}` : `V${b.bottom}`, `H${b.x}`);
  }
  left.push(`V${sortedRows[0].y}`);

  return {
    path: `M${sortedRows[0].x},${sortedRows[0].y} ${right.join(" ")} ${left.join(" ")} Z`,
    bounds,
  };
}
