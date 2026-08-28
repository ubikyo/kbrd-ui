import { expect, test } from "vitest";
import { defaultLayout } from "./layout";
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
