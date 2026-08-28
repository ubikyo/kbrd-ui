import type { LayoutData } from "../types/layout";

export function defaultLayout(items: LayoutData[]) {
  return items.find((item) => item.name.toLowerCase() === "default") ?? items[0];
}
