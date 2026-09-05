import { api } from "./client";
import type { DisplayData } from "../types/layout";

const DISPLAY_URL = "/api/display";

export const getDisplay = () => api<DisplayData>(DISPLAY_URL);

export const updateDisplay = (payload: DisplayData) =>
  api<DisplayData>(DISPLAY_URL, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
