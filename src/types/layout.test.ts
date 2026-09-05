import { expect, test } from "vitest";
import { createDivideGrid } from "./layout";

test("createDivideGrid seeds division 0 with the original cell's plugin, the rest blank", () => {
  const original = {
    typeId: "kbrd.layout-key",
    typeConfig: { keyMode: "normal" },
    pluginIds: ["kbrd.render-label"],
  };
  const grid = createDivideGrid(2, 1, original);

  expect(grid.cells[0]).toEqual(original);
  expect(grid.cells[1]).toEqual({ typeId: null, typeConfig: {}, pluginIds: [] });
  // Unmerged from the start — no Unmerge needed to reveal the divisions.
  expect(grid.mergeGroups).toEqual([]);
});

test("createDivideGrid clones the original rather than aliasing it", () => {
  const original = {
    typeId: "kbrd.layout-key",
    typeConfig: { keyMode: "normal" },
    pluginIds: ["kbrd.render-label"],
  };
  const grid = createDivideGrid(2, 1, original);

  grid.cells[0].pluginIds.push("kbrd.render-key-symbol");
  grid.cells[0].typeConfig.keyMode = "shift";

  expect(original.pluginIds).toEqual(["kbrd.render-label"]);
  expect(original.typeConfig).toEqual({ keyMode: "normal" });
});
