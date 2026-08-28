import { expect, test } from "vitest";
import {
  cellOriginMm,
  cellSizeMm,
  defaultLayout,
  maxItems,
  occupiedCells,
  pitchMm,
  rowColOf,
} from "./layout";
import { defaultGridCell, type LayoutData } from "../types/layout";

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
