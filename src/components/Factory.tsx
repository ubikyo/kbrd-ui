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
  cellOriginMm,
  cellSizeMm,
  maxItems,
  occupiedCells,
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
 * while that component is rebuilt from scratch. It draws the "display" — a
 * rectangle standing in for KBRD-DEV's physical screen, sized to that
 * screen's aspect ratio (fetched from KBRD-API, which KBRD-DEV keeps up to
 * date) and fit to the available surface — and, inside it, an SVG grid of
 * cells sized from the Geometry settings (Unit, physical size, Gap — see
 * Settings › Geometry). SVG (rather than a CSS grid) is what lets a cell's
 * shape grow past a single grid slot via colspan/rowspan, which more
 * complex keys (an ISO Enter) will eventually need.
 *
 * Each cell is a drop target for the plugins dragged from `<Inspector>`'s
 * Plugins tab: a Layout plugin (kbrd.layout-key / kbrd.layout-space) sets
 * the cell's kind while in Layout mode — only one at a time — and, once a
 * cell is a Key, an Invoke/Display plugin can be dropped onto it while in
 * Mapping mode. Clicking a cell selects it for `<Inspector>`'s Properties
 * tab (Unit/Colspan/Rowspan in Layout mode).
 * TODO(preview-rebuild): assignments only live in `App`'s state for now;
 * nothing is persisted to a workspace yet since these synthetic cells have
 * no `key_ref` of their own to save against.
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

    onCellsChange((current) => {
      const cell = current[index] ?? defaultGridCell();

      if (mode === "layout") {
        if (plugin.category !== "Layout") return current;
        // Changing (or confirming) the cell's kind clears whatever
        // Mapping-mode plugins were attached to its previous kind.
        return {
          ...current,
          [index]:
            cell.typeId === plugin.id
              ? cell
              : {
                  ...defaultGridCell(),
                  typeId: plugin.id,
                  typeConfig: { ...plugin.defaultConfig },
                },
        };
      }

      if (
        plugin.category === "Layout" ||
        cell.typeId !== LAYOUT_KEY_PLUGIN_ID ||
        cell.pluginIds.includes(plugin.id)
      ) {
        return current;
      }
      return {
        ...current,
        [index]: { ...cell, pluginIds: [...cell.pluginIds, plugin.id] },
      };
    });
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
        <Box
          className="factory-display"
          aria-label="Display"
          style={{
            width: display.width,
            height: display.height,
            flexShrink: 0,
            boxSizing: "border-box",
            border: "1px solid var(--kbrd-border-alt)",
          }}
        >
          {itemsX > 0 && itemsY > 0 && occupied && (
            <svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${physicalWidthMm} ${physicalHeightMm}`}
            >
              {Array.from({ length: itemsX * itemsY }, (_, index) => {
                if (occupied.has(index)) return null;

                const cell = cells[index] ?? defaultGridCell();
                const { x, y } = cellOriginMm(index, itemsX, unitMm, gapMm);
                const { width, height } = cellSizeMm(cell, unitMm, gapMm);

                return (
                  <LayoutItem
                    key={index}
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    typeId={cell.typeId}
                    pluginIds={cell.pluginIds}
                    isDropTarget={dropTargetIndex === index}
                    onClick={() =>
                      onSelectCell(selectedCellIndex === index ? null : index)
                    }
                    onDragOver={(event) => handleDragOver(index, event)}
                    onDragLeave={() => handleDragLeave(index)}
                    onDrop={(event) => handleDrop(index, event)}
                  />
                );
              })}
            </svg>
          )}
        </Box>
      )}
    </Box>
  );
}
