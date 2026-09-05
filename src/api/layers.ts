import { api } from "./client";
import type { FactoryLayout } from "../types/layout";
import type {
  KeyPlugin,
  KeyProperty,
  KeyPropertyConfig,
  LayerData,
} from "../types/layer";

export const listLayers = (layoutId: number) =>
  api<LayerData[]>(`/api/layout/${layoutId}/layer`);

export const createLayer = (
  layoutId: number,
  name: string,
  description = "",
) =>
  api<LayerData>(`/api/layout/${layoutId}/layer`, {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });

export const activateLayer = (id: number) =>
  api<LayerData>(`/api/layer/${id}/activate`, { method: "PUT" });

export const deactivateLayer = () =>
  api<{ ok: boolean }>("/api/layer/active", { method: "DELETE" });

export const updateLayer = (
  id: number,
  name: string,
  description: string,
) =>
  api<LayerData>(`/api/layer/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, description }),
  });

export const deleteLayer = (id: number) =>
  api<{ ok: boolean }>(`/api/layer/${id}`, { method: "DELETE" });

// Autosaves `<Factory>`'s disposition onto this layer — see the effect
// in `App` — so it's reloaded whenever the user switches back to it.
export const updateFactoryLayout = (
  id: number,
  factoryLayout: FactoryLayout | null,
) =>
  api<LayerData>(`/api/layer/${id}/factory-layout`, {
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
    `/api/layer/${layerId}/keys/${encodeURIComponent(key)}/plugins`,
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
    `/api/layer/${layerId}/keys/${encodeURIComponent(key)}/plugins/duplicate-from`,
    {
      method: "POST",
      body: JSON.stringify({ source_key_ref: sourceKey }),
    },
  );

export const clearKey = (layerId: number, key: string) =>
  api<LayerData>(
    `/api/layer/${layerId}/keys/${encodeURIComponent(key)}`,
    { method: "DELETE" },
  );

export const moveKey = (
  layerId: number,
  sourceKey: string,
  destinationKey: string,
) =>
  api<LayerData>(
    `/api/layer/${layerId}/keys/${encodeURIComponent(sourceKey)}/move-to`,
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
    `/api/layer/${layerId}/keys/${encodeURIComponent(key)}/properties`,
    { method: "PUT", body: JSON.stringify({ config }) },
  );
