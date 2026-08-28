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
