import { Box } from "@mantine/core";
import { useEffect, useRef, useState } from "react";

import { getDevice, type DeviceStatus } from "../api/device";

const PADDING = 60;
const POLL_INTERVAL_MS = 5000;
// Used until KBRD-DEV registers a real screen resolution with KBRD-API.
const FALLBACK_RATIO = 16 / 9;

type Size = {
  width: number;
  height: number;
};

/**
 * Scaffold for the redesigned Preview: temporarily replaces `<Preview>`
 * while that component is rebuilt from scratch. For now it only lays out
 * the "display" — a rectangle standing in for KBRD-DEV's physical screen,
 * sized to that screen's aspect ratio (fetched from KBRD-API, which
 * KBRD-DEV keeps up to date) and fit to the available surface.
 */
export default function Factory() {
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
        />
      )}
    </Box>
  );
}
