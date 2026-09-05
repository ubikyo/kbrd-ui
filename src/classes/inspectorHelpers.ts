import type { KeyPlugin } from "../types/layer";
import type { KeyPropertyConfig } from "../types/layer";

export const COLOR_SWATCHES = [
  "#ffffff",
  "#adb5bd",
  "#ff6b6b",
  "#ffd43b",
  "#51cf66",
  "#339af0",
  "#845ef7",
  "#000000",
];

export const isHexColor = (value: string, alpha = false) =>
  new RegExp(alpha ? "^#[0-9a-f]{8}$" : "^#[0-9a-f]{6}$", "i").test(value);

export const DEFAULT_KEY_PROPERTIES: KeyPropertyConfig = {
  keyMode: "momentary",
  downEnabled: false,
  upBorderEnabled: true,
  downBorderEnabled: true,
  upBorderColor: "#808080",
  downBorderColor: "#ffffff",
  upBorderWidth: 1,
  downBorderWidth: 1,
  upBackgroundColor: "#00000000",
  downBackgroundColor: "#00000000",
};

export function truncate(value: string) {
  return value.length > 15 ? `${value.slice(0, 15)}…` : value;
}

/** A key plugin instance's own one-line summary in the Plugins accordion
 * — a label/media filename preview, or `null` for a plugin with nothing
 * worth previewing. */
export function pluginSummary(item: KeyPlugin) {
  if (
    item.plugin_id === "kbrd.render-label" ||
    item.plugin_id === "kbrd.render-key-symbol"
  ) {
    const text = item.config.text;
    return typeof text === "string" && text.trim()
      ? truncate(text.trim())
      : null;
  }
  if (
    item.plugin_id === "kbrd.render-image" ||
    item.plugin_id === "kbrd.render-video"
  ) {
    const name = item.config.name ?? item.config.media;
    return typeof name === "string" && name.trim()
      ? truncate(name.trim())
      : null;
  }
  return null;
}

/** A custom drag image (⠿ by default) for a plain HTML5 drag — Mantine's
 * own drag handles have nothing worth showing as the browser's default
 * drag image otherwise. */
export function setDragSymbol(event: React.DragEvent, symbol = "⠿") {
  const dragImage = document.createElement("div");
  dragImage.textContent = symbol;
  Object.assign(dragImage.style, {
    position: "fixed",
    top: "-100px",
    left: "-100px",
    padding: "4px 8px",
    border: "1px solid white",
    borderRadius: "4px",
    background: "#222120",
    color: "white",
    fontSize: "20px",
    lineHeight: "1",
  });
  document.body.appendChild(dragImage);
  event.dataTransfer.setDragImage(dragImage, 12, 12);
  requestAnimationFrame(() => dragImage.remove());
}
