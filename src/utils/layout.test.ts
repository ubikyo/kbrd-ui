import { expect, test } from "vitest";
import { defaultLayout, maxItems, pitchMm } from "./layout";
import type { LayoutData } from "../types/layout";

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
