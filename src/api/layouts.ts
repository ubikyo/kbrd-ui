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

// Clones this layout's own geometry/settings under a new name, cascading
// every one of its layers (each with its own factory layout, plugins and
// key properties) onto the new layout — a full copy of both modes' data,
// not just the physical geometry.
export const duplicateLayout = (
  id: number,
  payload: { name: string; description?: string },
) =>
  api<LayoutData>(`${LAYOUT_URL}/${id}/duplicate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

// Overwrites `targetId`'s own geometry/settings and every one of its
// layers with `sourceId`'s — the target keeps its own id/name, only its
// content changes.
export const replaceLayout = (targetId: number, sourceId: number) =>
  api<LayoutData>(`${LAYOUT_URL}/${targetId}/replace`, {
    method: "POST",
    body: JSON.stringify({ source_id: sourceId }),
  });
