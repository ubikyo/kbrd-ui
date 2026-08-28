import { api } from "./client";
import type { GeometryData } from "../types/geometry";

const GEOMETRY_URL = "/api/geometry";

// The geometry picker is gone; this resolves whichever geometry KBRD-API
// considers current — the active one, "default" by name, or the first
// alphabetically — see `kbrd_api.api.geometry.Geometry.find_default`.
export const getActiveGeometry = () =>
  api<GeometryData>(`${GEOMETRY_URL}/active`);
