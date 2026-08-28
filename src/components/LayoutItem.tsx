import type { DragEvent, MouseEvent } from "react";

import { pluginById } from "../plugins/registry";

const LABEL_FONT_SIZE_MM = 2.5;
const SELECTED_STROKE = "#00ff00";

type Props = {
  x: number;
  y: number;
  width: number;
  height: number;
  // Plugin id of the attached kbrd.layout-key / kbrd.layout-space instance,
  // or null when this cell hasn't been assigned a kind yet.
  typeId?: string | null;
  // Invoke/Display plugins attached in Mapping mode (only meaningful once
  // `typeId` is kbrd.layout-key).
  pluginIds?: string[];
  isSelected?: boolean;
  isDropTarget?: boolean;
  onClick?: (event: MouseEvent<SVGGElement>) => void;
  onDragOver?: (event: DragEvent<SVGGElement>) => void;
  onDragLeave?: (event: DragEvent<SVGGElement>) => void;
  onDrop?: (event: DragEvent<SVGGElement>) => void;
};

/** One SVG cell in the grid `<Factory>` lays out over the display, and a
 * drop target for the plugins dragged from `<Inspector>`'s Plugins tab. */
export default function LayoutItem({
  x,
  y,
  width,
  height,
  typeId = null,
  pluginIds = [],
  isSelected = false,
  isDropTarget = false,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: Props) {
  const type = typeId ? pluginById(typeId) : null;
  const stroke = isDropTarget
    ? "var(--kbrd-border-alt)"
    : isSelected
      ? SELECTED_STROKE
      : "var(--kbrd-border-color)";
  const labels = type
    ? [type.name, ...pluginIds.map((id) => pluginById(id)?.name).filter(Boolean)]
    : [];

  return (
    <g
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{ cursor: "pointer" }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="transparent"
        stroke={stroke}
        strokeWidth={1}
        strokeDasharray={isSelected ? undefined : "4 3"}
        vectorEffect="non-scaling-stroke"
      />
      {labels.length > 0 && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={LABEL_FONT_SIZE_MM}
          fill="var(--kbrd-border-alt)"
          style={{ pointerEvents: "none" }}
        >
          {labels.join(" · ")}
        </text>
      )}
    </g>
  );
}
