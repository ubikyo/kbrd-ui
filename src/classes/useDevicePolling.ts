import { useEffect, useState } from "react";

import { getDevice, type DeviceStatus } from "../api/device";

const POLL_INTERVAL_MS = 5000;

/**
 * KBRD-DEV's own reported resolution/aspect ratio, polled rather than
 * pushed — `<Factory>` falls back to KBRD-DEV's reference panel size
 * (`FALLBACK_WIDTH`/`FALLBACK_HEIGHT`) while nothing's connected.
 */
export function useDevicePolling() {
  const [device, setDevice] = useState<DeviceStatus>({ connected: false });

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

  return device;
}
