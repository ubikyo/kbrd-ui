export type LayoutPart = {
  width: number;
  height: number;
  align?: "left" | "center" | "right";
};

export type LayoutElement = {
  type?: "key" | "space";
  name?: string;
  ref?: string;
  rowspan?: number;
  colspan?: number;
  size: number;
  quantity?: number;
  parts?: LayoutPart[];
};

export type LayoutGroup = {
  name?: string;
  gap?: number;
  elements: LayoutElement[][];
};

export type LayoutData = {
  id: number;
  name: string;
  description: string;
  author: string;
  unit: "px" | "mm";
  geometry: LayoutGroup[];
  svg: string;
  created_at: string;
  layout: KeyboardLayout;
};

export type KeyLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  ref: string;
  name: string;
  parts: LayoutPart[];
  type: "key" | "space";
};

export type KeyboardLayout = {
  width: number;
  height: number;
  keys: KeyLayout[];
};

export type LayoutPayload = Pick<
  LayoutData,
  "name" | "description" | "author" | "unit" | "geometry"
>;

/** Physical grid settings edited in Settings › Geometry, shared between
 * `SettingsModal` (the editor) and `Factory` (the preview grid). */
export type LayoutSettings = {
  unitMm: number;
  physicalWidthMm: number;
  physicalHeightMm: number;
  gapMm: number;
};

/** Standard keycap widths, expressed as a multiple of the board's base Unit. */
export const UNIT_MULTIPLIERS = [
  1, 1.25, 1.5, 1.75, 2.25, 2.75, 6.25, 7,
] as const;
export type UnitMultiplier = (typeof UNIT_MULTIPLIERS)[number];

/**
 * One slot in `<Factory>`'s grid. Synthetic and local for now — see the
 * TODO on `Factory` — keyed by its top-left index in the grid
 * (`row * itemsX + col`), not by a real geometry `key_ref`.
 */
export type GridCell = {
  // Plugin id of the attached kbrd.layout-key / kbrd.layout-space instance.
  typeId: string | null;
  // That plugin instance's own config (e.g. LayoutKey's `keyMode`).
  typeConfig: Record<string, unknown>;
  // Invoke/Display plugins attached in Mapping mode.
  pluginIds: string[];
  // Keycap width, as a multiple of the board's Unit.
  unit: UnitMultiplier;
  // How many grid columns this cell spans to the right (1 = itself only).
  colspan: number;
  // How many grid rows this cell spans downward (1 = itself only).
  rowspan: number;
};

export function defaultGridCell(): GridCell {
  return {
    typeId: null,
    typeConfig: {},
    pluginIds: [],
    unit: 1,
    colspan: 1,
    rowspan: 1,
  };
}
