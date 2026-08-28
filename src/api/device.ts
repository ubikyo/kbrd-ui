import { api } from "./client";

const DEVICE_URL = "/api/device";

export type DeviceStatus =
  | { connected: false }
  | { connected: true; width: number; height: number };

export const getDevice = () => api<DeviceStatus>(DEVICE_URL);
