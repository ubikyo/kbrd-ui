import { api } from "./client";
import type { FactoryLayout } from "../types/layout";
import type {
  KeyPlugin,
  KeyProperty,
  KeyPropertyConfig,
  LayerData,
} from "../types/layer";

// KBRD-API still calls this a "workspace" — its routes, and the
// `workspace_id` field on `KeyPlugin`, are unrenamed on purpose so the
// wire contract doesn't move; only kbrd-web's own naming became "Layer".

export const listLayers = (geometryId: number) =>
  api<LayerData[]>(`/api/geometry/${geometryId}/workspace`);

export const createLayer = (
  geometryId: number,
  name: string,
  description = "",
) =>
  api<LayerData>(`/api/geometry/${geometryId}/workspace`, {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });

export const activateLayer = (id: number) =>
  api<LayerData>(`/api/workspace/${id}/activate`, { method: "PUT" });

export const deactivateLayer = () =>
  api<{ ok: boolean }>("/api/workspace/active", { method: "DELETE" });

export const updateLayer = (
  id: number,
  name: string,
  description: string,
) =>
  api<LayerData>(`/api/workspace/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, description }),
  });

export const deleteLayer = (id: number) =>
  api<{ ok: boolean }>(`/api/workspace/${id}`, { method: "DELETE" });

// Autosaves `<Factory>`'s disposition onto this layer — see the effect
// in `App` — so it's reloaded whenever the user switches back to it.
export const updateFactoryLayout = (
  id: number,
  factoryLayout: FactoryLayout | null,
) =>
  api<LayerData>(`/api/workspace/${id}/factory-layout`, {
    method: "PUT",
    body: JSON.stringify({ factory_layout: factoryLayout }),
  });

export const addKeyPlugin = (
  layerId: number,
  key: string,
  pluginId: string,
  pluginVersion: string,
  config: unknown,
) =>
  api<KeyPlugin>(
    `/api/workspace/${layerId}/keys/${encodeURIComponent(key)}/plugins`,
    {
      method: "POST",
      body: JSON.stringify({
        plugin_id: pluginId,
        plugin_version: pluginVersion,
        config,
      }),
    },
  );

export const duplicateKeyPlugins = (
  layerId: number,
  key: string,
  sourceKey: string,
) =>
  api<KeyPlugin[]>(
    `/api/workspace/${layerId}/keys/${encodeURIComponent(key)}/plugins/duplicate-from`,
    {
      method: "POST",
      body: JSON.stringify({ source_key_ref: sourceKey }),
    },
  );

export const clearKey = (layerId: number, key: string) =>
  api<LayerData>(
    `/api/workspace/${layerId}/keys/${encodeURIComponent(key)}`,
    { method: "DELETE" },
  );

export const moveKey = (
  layerId: number,
  sourceKey: string,
  destinationKey: string,
) =>
  api<LayerData>(
    `/api/workspace/${layerId}/keys/${encodeURIComponent(sourceKey)}/move-to`,
    {
      method: "POST",
      body: JSON.stringify({ destination_key_ref: destinationKey }),
    },
  );

export const updateKeyPlugin = (id: number, data: Partial<KeyPlugin>) =>
  api<KeyPlugin>(`/api/key-plugin/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteKeyPlugin = (id: number) =>
  api<{ ok: boolean }>(`/api/key-plugin/${id}`, { method: "DELETE" });

export const updateKeyProperties = (
  layerId: number,
  key: string,
  config: KeyPropertyConfig,
) =>
  api<KeyProperty>(
    `/api/workspace/${layerId}/keys/${encodeURIComponent(key)}/properties`,
    { method: "PUT", body: JSON.stringify({ config }) },
  );
