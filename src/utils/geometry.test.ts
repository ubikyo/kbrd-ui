import { expect, test } from "vitest";
import { defaultGeometry } from "./geometry";
import type { GeometryData } from "../types/geometry";

const geometry = (id: number, name: string) => ({ id, name }) as GeometryData;

test("selects the default geometry regardless of its position", () => {
  const result = defaultGeometry([
    geometry(1, "ISO"),
    geometry(2, "Default"),
  ]);
  expect(result?.id).toBe(2);
});

test("falls back to the first geometry", () => {
  expect(defaultGeometry([geometry(1, "ISO")])?.id).toBe(1);
  expect(defaultGeometry([])).toBeUndefined();
});
