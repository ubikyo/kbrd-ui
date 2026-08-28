import { Box } from "@mantine/core";
import { useEffect, useRef, useState } from "react";

import { getDevice, type DeviceStatus } from "../api/device";
import type { LayoutSettings } from "../types/layout";
import { maxItems } from "../utils/layout";
import LayoutItem from "./LayoutItem";

const PADDING = 60;
const POLL_INTERVAL_MS = 5000;
// Used until KBRD-DEV registers a real screen resolution with KBRD-API.
const FALLBACK_RATIO = 16 / 9;

type Size = {
  width: number;
  height: number;
};

type Props = LayoutSettings;

/**
 * Scaffold for the redesigned Preview: temporarily replaces `<Preview>`
 * while that component is rebuilt from scratch. For now it lays out the
 * "display" — a rectangle standing in for KBRD-DEV's physical screen,
 * sized to that screen's aspect ratio (fetched from KBRD-API, which
 * KBRD-DEV keeps up to date) and fit to the available surface — plus a
 * centered grid of `LayoutItem` placeholders sized from the Geometry
 * settings (Unit, physical size, Gap — see Settings › Geometry).
 */
export default function Factory({
  unitMm,
  physicalWidthMm,
  physicalHeightMm,
  gapMm,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [device, setDevice] = useState<DeviceStatus>({ connected: false });

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
              {Array.from({ length: grid.itemsX * grid.itemsY }, (_, index) => (
                <LayoutItem
                  key={index}
                  width={grid.itemWidth}
                  height={grid.itemHeight}
                />
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
