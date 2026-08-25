export type GeometryPart = {
  width: number;
  height: number;
  align?: "left" | "center" | "right";
};

export type GeometryElement = {
  type?: "key" | "space";
  name?: string;
  ref?: string;
  rowspan?: number;
  colspan?: number;
  size: number;
  quantity?: number;
  parts?: GeometryPart[];
};

export type GeometryGroup = {
  name?: string;
  gap?: number;
  elements: GeometryElement[][];
};

export type GeometryData = {
  id: number;
  name: string;
  description: string;
  author: string;
  unit: "px" | "mm";
  geometry: GeometryGroup[];
  svg: string;
  created_at: string;
  layout: GeometryLayout;
};

export type KeyLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  ref: string;
  name: string;
  parts: unknown[];
};

export type GeometryLayout = {
  width: number;
  height: number;
  keys: KeyLayout[];
};

export type GeometryPayload = Pick<
  GeometryData,
  "name" | "description" | "author" | "unit" | "geometry"
>;
