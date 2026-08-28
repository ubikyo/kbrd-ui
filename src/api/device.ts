import { api } from "./client";

const DEVICE_URL = "/api/device";

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
