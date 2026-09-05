import type { DragEvent, MouseEvent as ReactMouseEvent, ReactElement } from "react";

import { isMappingVisible } from "../plugins/registry";
import type { DivideGrid } from "../types/layout";
import {
  divisionCellRect,
  divisionOutline,
  groupOf,
  type CellRect,
} from "../utils/layout";
import LayoutCell from "./LayoutCell";

type Props = {
  mode: "layout" | "mapping";
  parentId: number;
  divide: DivideGrid;
  parentRect: CellRect;
  parentUnit: number;
  selectedCellIndices: number[];
  selectedDivisionIndices: number[];
  isDropTarget: (subId: number) => boolean;
  onDivisionClick: (
    parentId: number,
    divide: DivideGrid,
    subId: number,
    event: ReactMouseEvent<SVGGElement>,
  ) => void;
  onDivisionContextMenu: (
    parentId: number,
    divide: DivideGrid,
    subId: number,
    event: ReactMouseEvent<SVGGElement>,
  ) => void;
  onDivisionDragOver: (
    parentId: number,
    subId: number,
    event: DragEvent<SVGGElement>,
  ) => void;
  onDivisionDragLeave: (parentId: number, subId: number) => void;
  onDivisionDrop: (
    parentId: number,
    divide: DivideGrid,
    subId: number,
    event: DragEvent<SVGGElement>,
  ) => void;
};

/**
 * `parentId`'s own division grid (see `GridCell.divide`) in place of the
 * one plain `<LayoutCell>` an ordinary cell gets — one `<LayoutCell>` per
 * division *group* (a division merged with a sibling renders once, from
 * its primary, exactly like a top-level merge does), laid out directly
 * over `parentRect` with no gap between any of them
 * (`divisionCellRect`/`divisionOutline`), rather than going through
 * `layoutRow`'s ordinary same-row, `gapMm`-spaced flow. Pulled out of
 * `<Display>` (as `renderDivisions`) since it's a self-contained rendering
 * pass — see `Display`'s own comment on the resize grip for why the
 * border-dedup pass below needs a second, later pass of its own too.
 */
export default function LayoutCellDivision({
  mode,
  parentId,
  divide,
  parentRect,
  parentUnit,
  selectedCellIndices,
  selectedDivisionIndices,
  isDropTarget,
  onDivisionClick,
  onDivisionContextMenu,
  onDivisionDragOver,
  onDivisionDragLeave,
  onDivisionDrop,
}: Props) {
  const count = divide.cols * divide.rows;
  const cols = divide.cols;

  // Resolved once up front — both the border-dedup pass below and the
  // regular rendering pass need each division's group/primary and
  // highlighted state.
  const status = Array.from({ length: count }, (_, subId) => {
    const group = groupOf(subId, divide.mergeGroups);
    const primary = Math.min(...group);
    const isSelected =
      selectedCellIndices.length === 1 &&
      selectedCellIndices[0] === parentId &&
      selectedDivisionIndices.includes(primary);
    return {
      group,
      primary,
      isMerged: group.length > 1,
      isSelected,
      isDropTarget: isDropTarget(primary),
      // Mapping mode only ever shows a division whose own Layout plugin
      // opts into it (`mapping-visible`) — same rule as `Display`'s own
      // top-level cells, just per-division.
      isVisible: mode === "layout" || isMappingVisible(divide.cells[primary]?.typeId),
    };
  });
  const isHighlighted = (subId: number) =>
    status[subId].isSelected || status[subId].isDropTarget;

  // Two adjacent, both-dashed divisions each stroking their own full
  // border would draw their shared edge twice — and since each one's
  // dash pattern starts counting from its own path's own start point,
  // the two independently-phased dashed strokes can land out of sync
  // and visually fill each other's gaps in, reading as one solid line
  // where neither one actually is. So a "baseline" division (unmerged,
  // not selected, not the drop target) never draws a side it shares
  // with another baseline one — only the side that "owns" it does
  // (right/bottom always wins over left/top — an arbitrary but
  // consistent tie-break, equivalent to a spreadsheet's own
  // border-collapse) — or with a highlighted one (whose own full
  // border already covers it). A merged group still traces its own
  // full outline unconditionally, same as before — including towards a
  // baseline neighbour, a rarer pairing this doesn't fully dedupe.
  const borderSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let subId = 0; subId < count; subId++) {
    if (status[subId].isMerged || isHighlighted(subId) || !status[subId].isVisible) {
      continue;
    }
    const row = Math.floor(subId / cols);
    const col = subId % cols;
    const rect = divisionCellRect(subId, divide, parentRect);
    const neighbourOf = (dRow: number, dCol: number) => {
      const r = row + dRow;
      const c = col + dCol;
      return r < 0 || r >= divide.rows || c < 0 || c >= cols ? null : r * cols + c;
    };
    const drawsTowards = (dRow: number, dCol: number, owns: boolean) => {
      const otherId = neighbourOf(dRow, dCol);
      if (otherId === null) return true; // the grid's own outer edge
      if (isHighlighted(otherId)) return false; // its own full border covers it
      if (status[otherId].isMerged) return true; // accept the rare double-render risk
      if (!status[otherId].isVisible) return true; // nothing there to share the edge with
      return owns; // both baseline — only the owning side draws it
    };
    if (drawsTowards(0, -1, false)) {
      borderSegments.push({ x1: rect.x, y1: rect.y, x2: rect.x, y2: rect.y + rect.height });
    }
    if (drawsTowards(-1, 0, false)) {
      borderSegments.push({ x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y });
    }
    if (drawsTowards(0, 1, true)) {
      borderSegments.push({
        x1: rect.x + rect.width,
        y1: rect.y,
        x2: rect.x + rect.width,
        y2: rect.y + rect.height,
      });
    }
    if (drawsTowards(1, 0, true)) {
      borderSegments.push({
        x1: rect.x,
        y1: rect.y + rect.height,
        x2: rect.x + rect.width,
        y2: rect.y + rect.height,
      });
    }
  }

  const rendered = new Set<number>();
  // Whichever sibling comes later in this array visually wins on any
  // shared edge it still has (SVG paints in document order) — with
  // border-dedup above, that's now only ever a highlighted item next
  // to a baseline one it no longer draws anything towards anyway, but
  // this stays as a defensive ordering all the same, the same reason
  // `Display` already renders the resize grip in its own pass after
  // every cell.
  const items: { key: string; priority: boolean; element: ReactElement }[] = [];
  for (let subId = 0; subId < count; subId++) {
    const {
      group,
      primary,
      isSelected,
      isDropTarget: primaryIsDropTarget,
      isMerged,
      isVisible,
    } = status[subId];
    if (rendered.has(primary)) continue;
    rendered.add(primary);
    if (!isVisible) continue;

    const divCell = divide.cells[primary];
    // A division with no plugin yet reads exactly like the row's own
    // trailing empty space (`isEmpty` there too): no text at all (see
    // `unit` below — `undefined` skips the size label the same way it
    // already does for `typeId`/`pluginIds`), and selecting it stays
    // dashed rather than solid, since there's nothing real there yet —
    // just a spot a plugin could still be dropped onto.
    const hasContent = Boolean(divCell?.typeId);
    const outline = isMerged ? divisionOutline(group, divide, parentRect) : null;
    const bounds = outline?.bounds ?? divisionCellRect(primary, divide, parentRect);
    // Only the width matters for a division's own size label — its
    // height always matches the row's fixed cap size regardless of how
    // many `divide.rows` share it. Expressed as a share of the parent
    // cell's own Unit, by its own share of the parent's physical width
    // (its bounding box, so a merged, possibly stepped group still
    // reads as its true on-screen footprint) — rounded for a clean
    // "0.5U"-style label instead of a repeating decimal.
    const unit = hasContent
      ? Math.round((bounds.width / parentRect.width) * parentUnit * 100) / 100
      : undefined;

    items.push({
      key: `division-${parentId}-${primary}`,
      priority: isSelected || primaryIsDropTarget,
      element: (
        <LayoutCell
          key={`division-${parentId}-${primary}`}
          bounds={bounds}
          path={outline?.path}
          labelBounds={outline?.labelBounds}
          typeId={divCell?.typeId}
          pluginIds={divCell?.pluginIds}
          unit={unit}
          isEmpty={!hasContent}
          isSelected={isSelected}
          isDropTarget={primaryIsDropTarget}
          // A baseline (unmerged, unhighlighted) division's border is
          // drawn once, deduplicated, in `borderSegments` above instead.
          showBorder={isMerged || isSelected || primaryIsDropTarget}
          showText={mode === "layout"}
          onClick={(event) => onDivisionClick(parentId, divide, primary, event)}
          onContextMenu={(event) =>
            onDivisionContextMenu(parentId, divide, primary, event)
          }
          onDragOver={(event) => onDivisionDragOver(parentId, primary, event)}
          onDragLeave={() => onDivisionDragLeave(parentId, primary)}
          onDrop={(event) => onDivisionDrop(parentId, divide, primary, event)}
        />
      ),
    });
  }

  const borderLines = borderSegments.map((segment, index) => (
    <line
      key={`division-border-${parentId}-${index}`}
      x1={segment.x1}
      y1={segment.y1}
      x2={segment.x2}
      y2={segment.y2}
      stroke="var(--kbrd-border-color)"
      strokeWidth={1}
      strokeDasharray="4 3"
      vectorEffect="non-scaling-stroke"
      style={{ pointerEvents: "none" }}
    />
  ));

  return [
    ...borderLines,
    ...items.filter((item) => !item.priority).map((item) => item.element),
    ...items.filter((item) => item.priority).map((item) => item.element),
  ];
}
