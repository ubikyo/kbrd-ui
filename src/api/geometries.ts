import { api } from "./client";
import type { GeometryData, GeometryPayload } from "../types/geometry";

const GEOMETRY_URL = "/api/geometry";

export const listGeometries = () => api<GeometryData[]>(GEOMETRY_URL);

export const createGeometry = (payload: GeometryPayload) =>
  api<GeometryData>(GEOMETRY_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateGeometry = (id: number, payload: GeometryPayload) =>
  api<GeometryData>(`${GEOMETRY_URL}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteGeometry = (id: number) =>
  api<{ ok: boolean }>(`${GEOMETRY_URL}/${id}`, { method: "DELETE" });
