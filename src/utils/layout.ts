import type { LayoutData } from "../types/layout";

export function defaultLayout(items: LayoutData[]) {
  return items.find((item) => item.name.toLowerCase() === "default") ?? items[0];
}

/** Centre-to-centre spacing between two adjacent items. */
export function pitchMm(unitMm: number, gapMm: number) {
  return unitMm + gapMm;
}

/**
 * How many `unitMm`-sized items fit along `physicalMm`, spaced `gapMm`
 * apart. `n` items take `n * unitMm + (n - 1) * gapMm` — solving for the
 * largest `n` that still fits gives `floor((physicalMm + gapMm) / pitch)`.
 */
export function maxItems(physicalMm: number, unitMm: number, gapMm: number) {
  const pitch = pitchMm(unitMm, gapMm);
  if (pitch <= 0 || physicalMm <= 0) return 0;
  return Math.max(0, Math.floor((physicalMm + gapMm) / pitch));
}
