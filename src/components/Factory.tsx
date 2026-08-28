import { Box } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";

import { getDevice, type DeviceStatus } from "../api/device";
import { pluginById } from "../plugins/registry";
import type { LayoutSettings } from "../types/layout";
import { maxItems } from "../utils/layout";
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

type CellAssignment = {
  // Plugin id of the attached kbrd.layout-key / kbrd.layout-space instance.
  typeId: string | null;
  // Invoke/Display plugins attached in Mapping mode.
  pluginIds: string[];
};

type Props = LayoutSettings & {
  mode: "layout" | "mapping";
};

/**
 * Scaffold for the redesigned Preview: temporarily replaces `<Preview>`
 * while that component is rebuilt from scratch. For now it lays out the
 * "display" — a rectangle standing in for KBRD-DEV's physical screen,
 * sized to that screen's aspect ratio (fetched from KBRD-API, which
 * KBRD-DEV keeps up to date) and fit to the available surface — plus a
 * centered grid of `LayoutItem` cells sized from the Geometry settings
 * (Unit, physical size, Gap — see Settings › Geometry).
 *
 * Each cell is a drop target for the plugins dragged from `<Inspector>`'s
 * Plugins tab: a Layout plugin (kbrd.layout-key / kbrd.layout-space) sets
 * the cell's kind while in Layout mode, and — once a cell is a Key — an
 * Invoke/Display plugin can be dropped onto it while in Mapping mode.
 * TODO(preview-rebuild): assignments only live in this component's state
 * for now; nothing is persisted to a workspace yet since these synthetic
 * cells have no `key_ref` of their own to save against.
 */
export default function Factory({
  unitMm,
  physicalWidthMm,
  physicalHeightMm,
  gapMm,
  mode,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [device, setDevice] = useState<DeviceStatus>({ connected: false });
  const [cells, setCells] = useState<Record<number, CellAssignment>>({});
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

  // Physical mm converted to display pixels — independent x/y scale since
  // the resolution's aspect ratio and the physical size's aspect ratio
  // aren't guaranteed to match exactly.
  const grid = (() => {
    if (!display || physicalWidthMm <= 0 || physicalHeightMm <= 0) return null;

    const itemsX = maxItems(physicalWidthMm, unitMm, gapMm);
    const itemsY = maxItems(physicalHeightMm, unitMm, gapMm);
    if (itemsX <= 0 || itemsY <= 0) return null;

    const scaleX = display.width / physicalWidthMm;
    const scaleY = display.height / physicalHeightMm;
    return {
      itemsX,
      itemsY,
      itemWidth: unitMm * scaleX,
      itemHeight: unitMm * scaleY,
      gapX: gapMm * scaleX,
      gapY: gapMm * scaleY,
    };
  })();

  function handleDragOver(index: number, event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes(PLUGIN_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropTargetIndex(index);
  }

  function handleDragLeave(index: number, event: DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDropTargetIndex((current) => (current === index ? null : current));
    }
  }

  function handleDrop(index: number, event: DragEvent<HTMLDivElement>) {
    const pluginId = event.dataTransfer.getData(PLUGIN_DRAG_TYPE);
    const plugin = pluginById(pluginId);
    if (!plugin) return;
    event.preventDefault();
    setDropTargetIndex(null);

    setCells((current) => {
      const cell = current[index] ?? { typeId: null, pluginIds: [] };

      if (mode === "layout") {
        if (plugin.category !== "Layout") return current;
        // Changing (or confirming) the cell's kind clears whatever
        // Mapping-mode plugins were attached to its previous kind.
        return {
          ...current,
          [index]: {
            typeId: plugin.id,
            pluginIds: cell.typeId === plugin.id ? cell.pluginIds : [],
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {grid && (
            <Box
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${grid.itemsX}, ${grid.itemWidth}px)`,
                gridTemplateRows: `repeat(${grid.itemsY}, ${grid.itemHeight}px)`,
                columnGap: grid.gapX,
                rowGap: grid.gapY,
              }}
            >
              {Array.from({ length: grid.itemsX * grid.itemsY }, (_, index) => {
                const cell = cells[index];
                return (
                  <LayoutItem
                    key={index}
                    width={grid.itemWidth}
                    height={grid.itemHeight}
                    typeId={cell?.typeId}
                    pluginIds={cell?.pluginIds}
                    isDropTarget={dropTargetIndex === index}
                    onDragOver={(event) => handleDragOver(index, event)}
                    onDragLeave={(event) => handleDragLeave(index, event)}
                    onDrop={(event) => handleDrop(index, event)}
                  />
                );
              })}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
