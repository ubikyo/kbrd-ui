import { api } from "./client";
import type { KeyPlugin, WorkspaceData } from "../types/workspace";

export const listWorkspaces = (geometryId: number) =>
  api<WorkspaceData[]>(`/api/geometry/${geometryId}/workspace`);

export const createWorkspace = (
  geometryId: number,
  name: string,
  description = "",
) =>
  api<WorkspaceData>(`/api/geometry/${geometryId}/workspace`, {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });

export const activateWorkspace = (id: number) =>
  api<WorkspaceData>(`/api/workspace/${id}/activate`, { method: "PUT" });

export const deactivateWorkspace = () =>
  api<{ ok: boolean }>("/api/workspace/active", { method: "DELETE" });

export const updateWorkspace = (
  id: number,
  name: string,
  description: string,
) =>
  api<WorkspaceData>(`/api/workspace/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, description }),
  });

export const deleteWorkspace = (id: number) =>
  api<{ ok: boolean }>(`/api/workspace/${id}`, { method: "DELETE" });

export const addKeyPlugin = (
  workspaceId: number,
  key: string,
  pluginId: string,
  pluginVersion: string,
  config: unknown,
) =>
  api<KeyPlugin>(
    `/api/workspace/${workspaceId}/keys/${encodeURIComponent(key)}/plugins`,
    {
      method: "POST",
      body: JSON.stringify({
        plugin_id: pluginId,
        plugin_version: pluginVersion,
        config,
      }),
    },
  );

export const updateKeyPlugin = (id: number, data: Partial<KeyPlugin>) =>
  api<KeyPlugin>(`/api/key-plugin/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

export const deleteKeyPlugin = (id: number) =>
  api<{ ok: boolean }>(`/api/key-plugin/${id}`, { method: "DELETE" });
