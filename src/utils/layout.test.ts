import { expect, test } from "vitest";
import {
  cellOriginMm,
  cellSizeMm,
  defaultLayout,
  gridSizeMm,
  layoutRow,
  maxItems,
  occupiedCells,
  pitchMm,
  rowColOf,
} from "./layout";
import { defaultGridCell, type GridCell, type LayoutData } from "../types/layout";

const cellAt = (patch: Partial<GridCell> = {}) => ({
  ...defaultGridCell(),
  ...patch,
});

const layout = (id: number, name: string) => ({ id, name }) as LayoutData;

test("selects the default layout regardless of its position", () => {
  const result = defaultLayout([
    layout(1, "ISO"),
    layout(2, "Default"),
  ]);
  expect(result?.id).toBe(2);
});

test("falls back to the first layout", () => {
  expect(defaultLayout([layout(1, "ISO")])?.id).toBe(1);
  expect(defaultLayout([])).toBeUndefined();
});

test("pitch is the unit plus the gap", () => {
  expect(pitchMm(10, 2)).toBe(12);
  expect(pitchMm(19.05, 3)).toBeCloseTo(22.05);
});

test("maxItems fits as many items as the gap allows", () => {
  expect(maxItems(100, 10, 0)).toBe(10);
  expect(maxItems(94, 10, 2)).toBe(8);
  expect(maxItems(106, 10, 2)).toBe(9);
  expect(maxItems(216, 19.05, 3)).toBe(9);
  expect(maxItems(135, 19.05, 3)).toBe(6);
});

test("maxItems is zero when there is nothing to fit", () => {
  expect(maxItems(0, 10, 2)).toBe(0);
  expect(maxItems(100, 0, 0)).toBe(0);
});

test("gridSizeMm is the footprint maxItems fits within physicalMm", () => {
  const itemsX = maxItems(216, 19.05, 3);
  expect(gridSizeMm(itemsX, 19.05, 3)).toBe(itemsX * 19.05 + (itemsX - 1) * 3);
  expect(gridSizeMm(0, 19.05, 3)).toBe(0);
});

test("rowColOf derives the row/column from a flat grid index", () => {
  expect(rowColOf(0, 5)).toEqual({ row: 0, col: 0 });
  expect(rowColOf(4, 5)).toEqual({ row: 0, col: 4 });
  expect(rowColOf(5, 5)).toEqual({ row: 1, col: 0 });
  expect(rowColOf(7, 5)).toEqual({ row: 1, col: 2 });
});

test("cellOriginMm places a cell on the uniform base-Unit grid", () => {
  expect(cellOriginMm(0, 5, 10, 2)).toEqual({ x: 0, y: 0, row: 0, col: 0 });
  expect(cellOriginMm(7, 5, 10, 2)).toEqual({ x: 24, y: 12, row: 1, col: 2 });
});

test("cellSizeMm folds a spanned cell's internal gaps into one shape", () => {
  const cell = { ...defaultGridCell(), colspan: 2 };
  expect(cellSizeMm(cell, 19.05, 3)).toEqual({
    width: 2 * 19.05 + 3,
    height: 19.05,
  });
});

test("cellSizeMm scales width by the cell's own Unit, height by the base Unit", () => {
  const cell = { ...defaultGridCell(), unit: 1.25 as const, rowspan: 2 };
  expect(cellSizeMm(cell, 10, 2)).toEqual({
    width: 1.25 * 10,
    height: 2 * 10 + 2,
  });
});

test("occupiedCells marks every slot a colspan/rowspan covers besides its origin", () => {
  const cells = { 0: { ...defaultGridCell(), colspan: 2, rowspan: 2 } };
  const occupied = occupiedCells(cells, 5, 5);
  expect([...occupied.entries()]).toEqual(
    expect.arrayContaining([
      [1, 0],
      [5, 0],
      [6, 0],
    ]),
  );
  expect(occupied.has(0)).toBe(false);
});

test("occupiedCells ignores spans that would run off the grid", () => {
  const cells = { 4: { ...defaultGridCell(), colspan: 3 } };
  const occupied = occupiedCells(cells, 5, 1);
  expect(occupied.size).toBe(0);
});

test("layoutRow defaults an untouched row to itemsX individual 1U slots", () => {
  const slots = layoutRow(0, 9, {}, new Map(), 1, 0);
  expect(slots).toHaveLength(9);
  expect(slots.every((slot) => slot.width === 1)).toBe(true);
  expect(slots[8].isRemainder).toBe(true);
  expect(slots.slice(0, 8).every((slot) => !slot.isRemainder)).toBe(true);
  expect(slots[8].x).toBe(8);
});

test("layoutRow's untouched-row slots reach the display's own edge, gaps included", () => {
  // Regression: an empty row used to render as one filler sized
  // `itemsX * unitMm` alone, ignoring the (itemsX - 1) gaps those itemsX
  // slots have between them — visibly too narrow, stopping well short of
  // the display's edge.
  const itemsX = maxItems(216, 19.05, 3); // 9
  const slots = layoutRow(0, itemsX, {}, new Map(), 19.05, 3);
  const last = slots[slots.length - 1];
  expect(last.x + last.width).toBeCloseTo(gridSizeMm(itemsX, 19.05, 3));
});

test("layoutRow: 1.25U, 1.25U, then plain 1U defaults leave a 0.5U remainder", () => {
  const cells: Record<number, GridCell> = {
    0: cellAt({ unit: 1.25 }),
    1: cellAt({ unit: 1.25 }),
  };
  const slots = layoutRow(0, 9, cells, new Map(), 1, 0);
  expect(slots).toHaveLength(9);
  const remainder = slots[8];
  expect(remainder.isRemainder).toBe(true);
  expect(remainder.index).toBe(8);
  expect(remainder.width).toBeCloseTo(0.5);
});

test("layoutRow: 2.75U then plain 1U defaults leave a 0.25U remainder one column early", () => {
  const cells: Record<number, GridCell> = { 0: cellAt({ unit: 2.75 }) };
  const slots = layoutRow(0, 9, cells, new Map(), 1, 0);
  // The wider first key eats the budget faster, so the row runs out at
  // column 7 — column 8 never gets laid out at all.
  expect(slots).toHaveLength(8);
  const remainder = slots[slots.length - 1];
  expect(remainder.index).toBe(7);
  expect(remainder.isRemainder).toBe(true);
  expect(remainder.width).toBeCloseTo(0.25);
});

test("layoutRow starts the next key right after the previous one's real edge", () => {
  const cells: Record<number, GridCell> = {
    0: cellAt({ unit: 1.25 }),
    1: cellAt(),
  };
  const slots = layoutRow(0, 9, cells, new Map(), 10, 3);
  expect(slots[0]).toMatchObject({ x: 0, width: 12.5 });
  expect(slots[1]).toMatchObject({ x: 12.5 + 3, width: 10 });
});

test("layoutRow skips columns a rowspan from a previous row already covers", () => {
  const occupied = new Map([[9, 0]]); // row 1, col 0 covered by row 0's cell
  const cells: Record<number, GridCell> = { 10: cellAt() }; // row 1, col 1
  const slots = layoutRow(1, 9, cells, occupied, 1, 0);
  expect(slots[0]).toMatchObject({ index: 10, x: 0 });
});
