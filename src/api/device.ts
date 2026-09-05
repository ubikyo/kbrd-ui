import { api } from "./client";

const DEVICE_URL = "/api/device";

// Used while no screen is connected, or its resolution isn't reported yet
// — see `Display` and `SettingsModal`, both of which fall back to this.
export const FALLBACK_WIDTH = 1280;
export const FALLBACK_HEIGHT = 800;

export type DeviceStatus =
  | { connected: false }
  | {
      connected: true;
      width: number;
      height: number;
      // `null` when the panel's EDID doesn't report a physical size.
      width_mm: number | null;
      height_mm: number | null;
    };

export const getDevice = () => api<DeviceStatus>(DEVICE_URL);
