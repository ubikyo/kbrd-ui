import type { KeyPlugin } from "../types/layer";
import type { KeyPropertyConfig, KeyStateConfig } from "../types/layer";

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

// Every key starts with exactly one state, named this — the States menu's
// own default (see `Inspector`'s Properties tab) and the name every
// plugin's own "Up" look is expected to sit under (`plugins/state.ts`).
export const DEFAULT_STATE_NAME = "Up";

export const DEFAULT_STATE_CONFIG: KeyStateConfig = {
  backgroundColor: "#00000000",
  borderEnabled: true,
  borderColor: "#808080",
  borderWidth: 1,
};

export const DEFAULT_KEY_PROPERTIES: KeyPropertyConfig = {
  keyMode: "momentary",
  states: [DEFAULT_STATE_NAME],
  stateConfigs: { [DEFAULT_STATE_NAME]: DEFAULT_STATE_CONFIG },
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

// A 1×1 fully-transparent GIF, used as the native drag image so the
// browser's own preview is invisible — the same constant react-dnd's
// `getEmptyImage()` uses for the same purpose. An unattached <canvas>
// doesn't reliably suppress the native preview in every browser (some
// fall back to snapshotting the whole page instead), but a pre-decoded
// data-URI image does, with no DOM attachment or load event needed.
// Built lazily (not at module load) so importing this file — e.g. for
// `DEFAULT_KEY_PROPERTIES`, from plain unit tests with no DOM — never
// touches `Image` at all unless a drag actually starts.
let hiddenDragImage: HTMLImageElement | undefined;
function getHiddenDragImage() {
  hiddenDragImage ??= (() => {
    const img = new Image();
    img.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
    return img;
  })();
  return hiddenDragImage;
}

/**
 * A small, cursor-following square that grows into a wider rounded
 * rectangle after a short delay, swapping its content in the process —
 * used as the shared visual for both dragging a plugin out of the
 * accordion (grip symbol → plugin name) and dragging a key's Mapping
 * content onto another key (⤵ symbol → plugin count). A real DOM element
 * rather than a native drag-image snapshot, since a native drag image is
 * a one-time capture the browser takes once at `dragstart` and can never
 * be changed afterwards.
 */
export function createFollowGhost(clientX: number, clientY: number, size: number, symbol: string) {
  const ghost = document.createElement("div");
  ghost.textContent = symbol;
  Object.assign(ghost.style, {
    position: "fixed",
    top: `${clientY}px`,
    left: `${clientX}px`,
    // Centred on the cursor regardless of the square's current size —
    // recomputed automatically as it grows, since the translate is
    // relative to the element's own (changing) dimensions.
    transform: "translate(-50%, -50%)",
    width: `${size}px`,
    height: `${size}px`,
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    overflow: "hidden",
    padding: "0 4px",
    border: "1px solid var(--kbrd-border-color)",
    borderRadius: "10px",
    backgroundColor: "color-mix(in srgb, var(--kbrd-color-body) 70%, transparent)",
    color: "#FFFFFF",
    fontSize: "18px",
    lineHeight: "1.1",
    whiteSpace: "normal",
    wordBreak: "break-word",
    pointerEvents: "none",
    zIndex: "9999",
    transition: "width 150ms ease, height 150ms ease, font-size 150ms ease",
  });
  document.body.appendChild(ghost);

  let growTimer: number | null = null;

  return {
    moveTo(x: number, y: number) {
      ghost.style.left = `${x}px`;
      ghost.style.top = `${y}px`;
    },
    /** Swaps to `content` at `width`×`height` after `delayMs` (default 300). */
    grow(content: string, width: number, height: number, delayMs = 300) {
      growTimer = window.setTimeout(() => {
        ghost.textContent = content;
        Object.assign(ghost.style, {
          width: `${width}px`,
          height: `${height}px`,
          fontSize: "12px",
        });
      }, delayMs);
    },
    /** Hides instantly (no transition) — for the moment the user actually
     * releases, ahead of whatever event ends up driving `remove()`. */
    hide() {
      ghost.style.display = "none";
    },
    remove() {
      if (growTimer !== null) window.clearTimeout(growTimer);
      ghost.remove();
    },
  };
}

/** A custom, animated drag ghost for dragging a plugin out of the
 * accordion: starts as a small square (the height of the accordion row
 * it was dragged from) showing the grip symbol, then grows into a
 * 100×50px rectangle showing the plugin's name. The native drag image is
 * replaced with `getHiddenDragImage()` so only this element is ever
 * visible. */
export function setPluginDragImage(event: React.DragEvent, pluginName: string) {
  const source = event.currentTarget as Element;
  const rowSize = source.getBoundingClientRect().height;

  event.dataTransfer.setDragImage(getHiddenDragImage(), 0, 0);

  const ghost = createFollowGhost(event.clientX, event.clientY, rowSize, "⠿");
  ghost.grow(truncate(pluginName), 100, 50, 300);

  // "drag" fires repeatedly on the source element while the gesture is
  // active and bubbles, so a single document-level listener is enough to
  // track the cursor. `clientX`/`clientY` are spuriously 0 on the very
  // last event some browsers fire right before "dragend" — ignore those
  // instead of snapping the ghost to the top-left corner.
  const move = (moveEvent: DragEvent) => {
    if (moveEvent.clientX === 0 && moveEvent.clientY === 0) return;
    ghost.moveTo(moveEvent.clientX, moveEvent.clientY);
  };
  document.addEventListener("drag", move);

  // "dragend" only fires once the browser finishes its own return-flight
  // animation for a drop that wasn't accepted anywhere (dropEffect
  // "none") — up to a few hundred ms of the ghost just sitting frozen in
  // place. The physical mouse button going up ("mouseup") is what the
  // user actually perceives as "release", and browsers keep delivering
  // it immediately even mid-drag, so hide the ghost on that instead of
  // waiting for "dragend"; "dragend" still runs the real listener
  // teardown and DOM removal right after; hiding twice is harmless.
  const hide = () => ghost.hide();
  window.addEventListener("mouseup", hide, { capture: true, once: true });

  const cleanup = () => {
    document.removeEventListener("drag", move);
    window.removeEventListener("mouseup", hide, { capture: true });
    source.removeEventListener("dragend", cleanup);
    ghost.remove();
  };
  source.addEventListener("dragend", cleanup);
}
