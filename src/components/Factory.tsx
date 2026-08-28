import { Box } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";

import { getDevice, type DeviceStatus } from "../api/device";
import { pluginById } from "../plugins/registry";
import {
  defaultGridCell,
  type GridCell,
  type LayoutSettings,
} from "../types/layout";
import {
  cellSizeMm,
  layoutRow,
  maxItems,
  occupiedCells,
  pitchMm,
} from "../utils/layout";
import LayoutItem from "./LayoutItem";

const PADDING = 60;
const POLL_INTERVAL_MS = 5000;
// Used until KBRD-DEV registers a real screen resolution with KBRD-API.
const FALLBACK_RATIO = 16 / 9;
const LAYOUT_KEY_PLUGIN_ID = "kbrd.layout-key";
const PLUGIN_DRAG_TYPE = "application/kbrd-plugin";

type Size = {
  width: number;
  height: number;
};

type Props = LayoutSettings & {
  mode: "layout" | "mapping";
  cells: Record<number, GridCell>;
  onCellsChange: (
    update: (current: Record<number, GridCell>) => Record<number, GridCell>,
  ) => void;
  selectedCellIndex: number | null;
  onSelectCell: (index: number | null) => void;
};

/**
 * Scaffold for the redesigned Preview: temporarily replaces `<Preview>`
 * while that component is rebuilt from scratch. The display — a rectangle
 * standing in for KBRD-DEV's physical screen, sized to that screen's
 * aspect ratio (fetched from KBRD-API, which KBRD-DEV keeps up to date)
 * and fit to the available surface — is drawn as part of the same SVG as
 * the key grid rather than a separate bordered box around it, so both
 * share one coordinate system and stay centered together. SVG (rather
 * than a CSS grid) is what lets a cell's shape grow past a single grid
 * slot via colspan/rowspan, which more complex keys (an ISO Enter) will
 * eventually need.
 *
 * Each row is laid out as an actual flow (`layoutRow`), not a grid of
 * fixed 1U slots: a 1.25U key really is 1.25U wide, everything after it
 * shifts over, and whatever Unit budget is left over at the end of the
 * row becomes a single trailing, unassigned filler slot.
 *
 * Every slot is a drop target for the plugins dragged from `<Inspector>`'s
 * Plugins tab: a Layout plugin (kbrd.layout-key / kbrd.layout-space) sets
 * the slot's kind while in Layout mode — only one at a time — and, once a
 * cell is a Key, an Invoke/Display plugin can be dropped onto it while in
 * Mapping mode. Dropping a plugin selects the slot; clicking one does too.
 * Only the selected cell shows the green outline (`<Inspector>`'s
 * Properties tab edits it in Layout mode).
 * TODO(preview-rebuild): assignments only live in `App`'s state for now;
 * nothing is persisted to a workspace yet since these synthetic cells have
 * no `key_ref` of their own to save against. Rowspan across rows whose
 * own flow gives them a different width also isn't stitched into a
 * stepped shape yet — it just extends the origin row's width downward.
 */
export default function Factory({
  unitMm,
  physicalWidthMm,
  physicalHeightMm,
  gapMm,
  mode,
  cells,
  onCellsChange,
  selectedCellIndex,
  onSelectCell,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [device, setDevice] = useState<DeviceStatus>({ connected: false });
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      getDevice().then(
        (status) => {
          if (!cancelled) setDevice(status);
        },
        () => {},
      );
    }
    poll();
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const clearDropTarget = () => setDropTargetIndex(null);
    window.addEventListener("dragend", clearDropTarget);
    window.addEventListener("drop", clearDropTarget);
    return () => {
      window.removeEventListener("dragend", clearDropTarget);
      window.removeEventListener("drop", clearDropTarget);
    };
  }, []);

  const ratio = device.connected ? device.width / device.height : FALLBACK_RATIO;

  const display = (() => {
    if (viewport.width <= 0 || viewport.height <= 0) return null;

    let width = viewport.width;
    let height = width / ratio;
    if (height > viewport.height) {
      height = viewport.height;
      width = height * ratio;
    }
    return { width, height };
  })();

  const itemsX = maxItems(physicalWidthMm, unitMm, gapMm);
  const itemsY = maxItems(physicalHeightMm, unitMm, gapMm);
  const occupied =
    itemsX > 0 && itemsY > 0 ? occupiedCells(cells, itemsX, itemsY) : null;
  const rowPitch = pitchMm(unitMm, gapMm);

  function handleDragOver(index: number, event: DragEvent<SVGGElement>) {
    if (!event.dataTransfer.types.includes(PLUGIN_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropTargetIndex(index);
  }

  function handleDragLeave(index: number) {
    setDropTargetIndex((current) => (current === index ? null : current));
  }

  function handleDrop(index: number, event: DragEvent<SVGGElement>) {
    const pluginId = event.dataTransfer.getData(PLUGIN_DRAG_TYPE);
    const plugin = pluginById(pluginId);
    if (!plugin) return;
    event.preventDefault();
    setDropTargetIndex(null);

    if (mode === "layout") {
      if (plugin.category !== "Layout") return;
      onCellsChange((current) => {
        const cell = current[index];
        // Changing (or confirming) the cell's kind clears whatever
        // Mapping-mode plugins were attached to its previous kind.
        return {
          ...current,
          [index]:
            cell?.typeId === plugin.id
              ? cell
              : {
                  ...defaultGridCell(),
                  typeId: plugin.id,
                  typeConfig: { ...plugin.defaultConfig },
                },
        };
      });
      onSelectCell(index);
      return;
    }

    const cell = cells[index];
    if (
      plugin.category === "Layout" ||
      cell?.typeId !== LAYOUT_KEY_PLUGIN_ID ||
      cell.pluginIds.includes(plugin.id)
    ) {
      return;
    }
    onCellsChange((current) => ({
      ...current,
      [index]: { ...cell, pluginIds: [...cell.pluginIds, plugin.id] },
    }));
    onSelectCell(index);
  }

  return (
    <Box
      ref={viewportRef}
      w="100%"
      h="100%"
      p={PADDING}
      style={{
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {display && (
        <svg
          className="factory-display"
          aria-label="Display"
          width={display.width}
          height={display.height}
          viewBox={`0 0 ${physicalWidthMm} ${physicalHeightMm}`}
          style={{ flexShrink: 0 }}
        >
          <rect
            x={0}
            y={0}
            width={physicalWidthMm}
            height={physicalHeightMm}
            fill="none"
            stroke="var(--kbrd-border-alt)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {occupied &&
            Array.from({ length: itemsY }, (_, row) =>
              layoutRow(row, itemsX, cells, occupied, unitMm, gapMm).map(
                (slot) => {
                  const cell = cells[slot.index];
                  const height = cell
                    ? cellSizeMm(cell, unitMm, gapMm).height
                    : unitMm;
                  return (
                    <LayoutItem
                      key={slot.index}
                      x={slot.x}
                      y={row * rowPitch}
                      width={slot.width}
                      height={height}
                      typeId={cell?.typeId}
                      pluginIds={cell?.pluginIds}
                      isSelected={selectedCellIndex === slot.index}
                      isDropTarget={dropTargetIndex === slot.index}
                      onClick={() =>
                        onSelectCell(
                          selectedCellIndex === slot.index ? null : slot.index,
                        )
                      }
                      onDragOver={(event) => handleDragOver(slot.index, event)}
                      onDragLeave={() => handleDragLeave(slot.index)}
                      onDrop={(event) => handleDrop(slot.index, event)}
                    />
                  );
                },
              ),
            )}
        </svg>
      )}
    </Box>
  );
}
