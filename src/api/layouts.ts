import { api } from "./client";
import type { LayoutData, LayoutPayload } from "../types/layout";

const LAYOUT_URL = "/api/layout";

export const listLayouts = () => api<LayoutData[]>(LAYOUT_URL);

export const createLayout = (payload: LayoutPayload) =>
  api<LayoutData>(LAYOUT_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateLayout = (id: number, payload: LayoutPayload) =>
  api<LayoutData>(`${LAYOUT_URL}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteLayout = (id: number) =>
  api<{ ok: boolean }>(`${LAYOUT_URL}/${id}`, { method: "DELETE" });
