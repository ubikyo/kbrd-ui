import type { DragEvent, MouseEvent, PointerEvent } from "react";

import { pluginById } from "../plugins/registry";
import type { CellRect } from "../utils/layout";

const LABEL_FONT_SIZE_MM = 2.5;
const SELECTED_STROKE = "#00ff00";
// A fixed screen size regardless of the grid's own scale (Caps size, zoom,
// how many rows fit…) — unlike the rest of a cell, which is drawn directly
// in the SVG's mm-space and so naturally scales with it, the grip is
// converted from these via `pxPerMm` (see `Factory`) so it always reads
// the same size on screen.
const GRIP_WIDTH_PX = 6;
const GRIP_HEIGHT_PX = 30;
// `GripVerticalIcon`'s own paths (from `@mantine/core`'s `GripIcon.tsx`),
// reused verbatim inside a nested `<svg viewBox="0 0 24 24">` so the dots
// render exactly as Mantine's do, non-uniform stretch included.
const GRIP_DOT_PATHS = [
  "M8 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M8 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M8 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M14 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M14 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M14 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
];
// `theme.ts` hardcodes the Splitter thumb's own background to white,
// overriding the app's otherwise-dark palette — the border and dot color
// are left at Mantine's own dark-scheme defaults (see `Splitter.css`'s
// `[data-mantine-color-scheme='dark']` rules).
const GRIP_BACKGROUND = "#FFFFFF";

type Props = {
  // Bounding box, used as the shape when `path` isn't given (a plain,
  // unmerged cell, or a merge whose members are all on the same row — a
  // simple rectangle either way) — and as the label's anchor too, absent
  // `labelBounds`.
  bounds: CellRect;
  // Outline of a merge spanning more than one row (a stepped/L shape).
  path?: string;
  // Where to centre the size/type label — defaults to `bounds`, but a
  // stepped or concave merge (see `mergedOutline`) wants its label
  // anchored on one of its own actual spans instead: `bounds`' centre,
  // the shape's plain bounding box, can fall in a notch the merge leaves
  // empty (wrapped around a cell that wasn't merged in, or just the gap
  // between two differently-sized stacked rows).
  labelBounds?: CellRect;
  // Plugin id of the attached kbrd.layout-key / kbrd.layout-space instance,
  // or null when this cell hasn't been assigned a kind yet.
  typeId?: string | null;
  // Invoke/Display plugins attached in Mapping mode (only meaningful once
  // `typeId` is kbrd.layout-key).
  pluginIds?: string[];
  // Keycap width as a multiple of the display's Unit, shown above the type
  // label — undefined when the cell itself is unknown (shouldn't normally
  // happen, since every `GridCell` has a `unit`).
  unit?: number;
  isSelected?: boolean;
  // A row's trailing empty space (or a fully empty row) rather than a real
  // cell — no `typeId` ever applies to it. Selecting it (to merge into, or
  // to paste a plugin onto) still shows green, but dashed rather than
  // solid, since there's nothing there yet.
  isEmpty?: boolean;
  isDropTarget?: boolean;
  // False for a division whose border `Factory` is instead drawing as
  // part of its own deduplicated pass over the whole division grid (see
  // `renderDivisions`) — two adjacent, both-dashed divisions each
  // stroking their own full outline would draw the exact same shared
  // edge twice, and since each shape's dash pattern starts counting from
  // its own path's own start point, the two independently-phased dashed
  // strokes can land out of sync and visually fill each other's gaps in,
  // reading as one solid line where neither one actually is.
  showBorder?: boolean;
  // Hides the size/type label text — Mapping mode's own look, where the
  // cell shape stays but the Layout-only "1U · Key" caption underneath it
  // doesn't (see `Factory`'s own `mode` prop).
  showText?: boolean;
  onClick?: (event: MouseEvent<SVGGElement>) => void;
  // Right-click — opens this cell's own context menu (see `App`'s
  // `contextMenu`), after selecting it the same way a left click does.
  onContextMenu?: (event: MouseEvent<SVGGElement>) => void;
  onDragOver?: (event: DragEvent<SVGGElement>) => void;
  onDragLeave?: (event: DragEvent<SVGGElement>) => void;
  onDrop?: (event: DragEvent<SVGGElement>) => void;
  // Starts dragging this cell itself to move it elsewhere on the display
  // (see `Factory`'s own pointer-based `handleCellPointerDown`/
  // `onMoveCell` — plain pointer events rather than native HTML5
  // drag-and-drop, which SVG elements support too inconsistently across
  // browsers to rely on). Only ever set for a plain, unmerged cell (a
  // merge's shape comes from all of its members together, so there's no
  // one well-defined place to drag *from*) — never for the row's own
  // empty space (nothing there to move).
  onPointerDown?: (event: PointerEvent<SVGGElement>) => void;
};

/** One SVG cell (or merged group of cells) in the grid `<Factory>` lays
 * out over the display, and a drop target for the plugins dragged from
 * `<Inspector>`'s Plugins tab. */
export default function LayoutItem({
  bounds,
  path,
  labelBounds = bounds,
  typeId = null,
  pluginIds = [],
  unit,
  isSelected = false,
  isEmpty = false,
  isDropTarget = false,
  showBorder = true,
  showText = true,
  onClick,
  onContextMenu,
  onDragOver,
  onDragLeave,
  onDrop,
  onPointerDown,
}: Props) {
  const type = typeId ? pluginById(typeId) : null;
  const stroke = isDropTarget
    ? "var(--kbrd-border-alt)"
    : isSelected
      ? SELECTED_STROKE
      : "var(--kbrd-border-color)";
  const sizeLabel = typeof unit === "number" ? `${unit}U` : null;
  const typeLabel = type
    ? [type.name, ...pluginIds.map((id) => pluginById(id)?.name).filter(Boolean)]
        .join(" · ")
    : null;
  const shapeProps = {
    fill: "transparent",
    // `mergedOutline` can trace a shape wrapped all the way around a cell
    // that wasn't merged in, coming out as an outer subpath plus an inner
    // one for the hole — `evenodd` is what tells a filled version of that
    // shape to punch the hole rather than fill straight through it.
    fillRule: "evenodd" as const,
    stroke,
    strokeWidth: showBorder ? 1 : 0,
    // Selected stays dashed for empty space — there's no real cell there
    // yet, only a spot something could still be merged or pasted into.
    strokeDasharray: isSelected && !isEmpty ? undefined : "4 3",
    vectorEffect: "non-scaling-stroke" as const,
  };

  return (
    <g
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPointerDown={onPointerDown}
      style={{ cursor: onPointerDown ? "grab" : "pointer" }}
    >
      {path ? (
        <path d={path} {...shapeProps} />
      ) : (
        <rect
          x={bounds.x}
          y={bounds.y}
          width={bounds.width}
          height={bounds.height}
          {...shapeProps}
        />
      )}
      {showText && sizeLabel && (
        <text
          x={labelBounds.x + labelBounds.width / 2}
          y={
            labelBounds.y +
            labelBounds.height / 2 -
            (typeLabel ? LABEL_FONT_SIZE_MM * 0.6 : 0)
          }
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={LABEL_FONT_SIZE_MM}
          fill="var(--kbrd-border-alt)"
          style={{ pointerEvents: "none" }}
        >
          {sizeLabel}
        </text>
      )}
      {showText && typeLabel && (
        <text
          x={labelBounds.x + labelBounds.width / 2}
          y={
            labelBounds.y +
            labelBounds.height / 2 +
            (sizeLabel ? LABEL_FONT_SIZE_MM * 0.6 : 0)
          }
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={LABEL_FONT_SIZE_MM}
          fill="var(--kbrd-border-alt)"
          style={{ pointerEvents: "none" }}
        >
          {typeLabel}
        </text>
      )}
    </g>
  );
}

type ResizeGripProps = {
  // The cell being resized — the grip sits centred on its right edge.
  bounds: CellRect;
  // The SVG's own scale (real screen pixels per mm — see `Factory`), used
  // to size the grip in fixed pixels regardless of the grid's own scale.
  pxPerMm: number;
  onResizeStart: (event: PointerEvent<SVGGElement>) => void;
};

/**
 * A cell's drag-resize handle — rendered by `Factory` as its own pass
 * *after* every cell in every row, so it always paints on top of them
 * (plain SVG document order otherwise puts a narrow-gap neighbour's own
 * border in front of a grip that overlaps it, since that neighbour is
 * later in the row).
 */
export function ResizeGrip({ bounds, pxPerMm, onResizeStart }: ResizeGripProps) {
  const gripHeight = pxPerMm > 0 ? GRIP_HEIGHT_PX / pxPerMm : 0;
  const gripWidth = pxPerMm > 0 ? GRIP_WIDTH_PX / pxPerMm : 0;
  const cx = bounds.x + bounds.width;
  const cy = bounds.y + bounds.height / 2;

  return (
    <g
      aria-label="Resize"
      onPointerDown={(event) => {
        event.stopPropagation();
        event.preventDefault();
        onResizeStart(event);
      }}
      onClick={(event) => event.stopPropagation()}
      style={{ cursor: "col-resize" }}
    >
      <rect
        x={cx - gripWidth / 2}
        y={cy - gripHeight / 2}
        width={gripWidth}
        height={gripHeight}
        rx={gripWidth / 2}
        fill={GRIP_BACKGROUND}
        stroke="var(--mantine-color-dark-4)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <svg
        x={cx - gripWidth / 2}
        y={cy - gripHeight / 2}
        width={gripWidth}
        height={gripHeight}
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--mantine-color-dimmed)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {GRIP_DOT_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </g>
  );
}
