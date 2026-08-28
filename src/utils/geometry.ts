import type { GeometryData } from "../types/geometry";

export function defaultGeometry(items: GeometryData[]) {
  return items.find((item) => item.name.toLowerCase() === "default") ?? items[0];
}
