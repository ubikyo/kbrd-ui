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
  // Caps size / Gap size (see `LayoutSettings`) — per-layout, persisted
  // on the geometry itself so they survive a reload or a switch back to
  // this layout — snake_case straight from KBRD-API, like `LayerData`'s
  // own fields. The physical screen's width/height are *not* here: see
  // `BoardData` — they're the same for every layout.
  unit_mm: number;
  gap_mm: number;
  // How many 1U reference items this layout uses, in each direction —
  // `null` means "as many as Caps size / Gap size / the board's own
  // physical size allow" (see `maxItems`); otherwise a ceiling *below*
  // that, never above it (see `Factory`'s `maxColumns` and `App`'s
  // `gridItemsY`, both of which still clamp to the computed max in case
  // Caps/Gap/the board changed since this was set).
  max_columns: number | null;
  max_rows: number | null;
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
  | "name"
  | "description"
  | "author"
  | "unit"
  | "geometry"
  | "unit_mm"
  | "gap_mm"
  | "max_columns"
  | "max_rows"
>;

/** The physical screen's own width/height (see KBRD-API's `board`) — one
 * value for the whole device, shared by every layout: switching layouts
 * must never resize this, unlike Caps size / Gap size (`LayoutData`'s own
 * `unit_mm`/`gap_mm`), which are per-layout. */
export type BoardData = {
  physical_width_mm: number;
  physical_height_mm: number;
};

/** Physical grid settings edited across Settings (physical width/height)
 * and the Layout editor (Caps size / Gap size), shared with `Factory` (the
 * preview grid) as one bag of numbers regardless of where each one is
 * actually edited or persisted — the camelCase, form-friendly shape of
 * `LayoutData`/`BoardData`'s own `*_mm` fields. */
export type LayoutSettings = {
  unitMm: number;
  physicalWidthMm: number;
  physicalHeightMm: number;
  gapMm: number;
};

/** Seeds a brand-new layout (Caps size / Gap size), or `App` before the
 * board/layout have loaded, until the real numbers are confirmed in
 * Settings / the Layout editor. `physicalWidthMm`/`physicalHeightMm`
 * still match KBRD-DEV's reference panel (see kbrd_dev/config.py's
 * calibration comment); `unitMm` matches KBRD's own 16mm keycaps instead. */
export const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
  unitMm: 16,
  physicalWidthMm: 216,
  physicalHeightMm: 135,
  gapMm: 3,
};

/** The Unit slider's own step and floor — a cell's width is always a
 * multiple of this, from `MIN_UNIT` up to whatever its row has left of
 * its budget (see `maxUnitForCell`). */
export const MIN_UNIT = 0.25;
export const UNIT_STEP = 0.25;

/**
 * One cell in `<Factory>`'s grid: a plugin dropped on the board. Synthetic
 * and local for now — see the TODO on `Factory` — identified by its own
 * stable id (see `nextCellId`), not by a real geometry `key_ref`. There
 * is no "default" cell: a row starts with none at all, and one only
 * exists once a Layout plugin (kbrd.layout-key / kbrd.layout-space) is
 * actually dropped on the board — see `rows` in `App`.
 */
export type GridCell = {
  // Plugin id of the attached kbrd.layout-key / kbrd.layout-space instance.
  typeId: string | null;
  // That plugin instance's own config (e.g. LayoutKey's `keyMode`).
  typeConfig: Record<string, unknown>;
  // Invoke/Display plugins attached in Mapping mode.
  pluginIds: string[];
  // Keycap width, as a multiple of the board's Unit — any multiple of
  // `UNIT_STEP` from `MIN_UNIT` up.
  unit: number;
};

export function defaultGridCell(unit = MIN_UNIT): GridCell {
  return {
    typeId: null,
    typeConfig: {},
    pluginIds: [],
    unit,
  };
}

/**
 * Groups of grid indices merged into one key — replaces colspan/rowspan.
 * Each group is sorted; a cell not listed in any group is its own,
 * unmerged singleton. The group's *primary* (its smallest index) is the
 * one whose `GridCell` (type, config, Mapping plugins) the whole merged
 * shape shows and edits — see `primaryOf`/`groupOf` in `utils/layout`.
 */
export type MergeGroups = number[][];

/**
 * `<Factory>`'s full grid disposition, as saved onto the current
 * `LayerData` (see `factory_layout`) — each layer keeps its own,
 * loaded back whenever the user switches to it. Everything `App` otherwise
 * keeps as local-only state: which cell ids populate each row
 * (`rowOverrides`, fed to `gridRows`), each cell's own data, and which
 * cells are merged.
 */
export type FactoryLayout = {
  rowOverrides: Record<number, number[]>;
  cells: Record<number, GridCell>;
  mergeGroups: MergeGroups;
};
