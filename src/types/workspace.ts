export type KeyPlugin = {
  id: number;
  workspace_id: number;
  key_ref: string;
  plugin_id: string;
  plugin_version: string;
  position: number;
  enabled: boolean;
  config: Record<string, unknown>;
};

export type KeyPropertyConfig = {
  borderEnabled: boolean;
  borderWidth: number;
  upBorderColor: string;
  downBorderColor: string;
  upBackgroundColor: string;
  downBackgroundColor: string;
};

export type KeyProperty = {
  key_ref: string;
  config: KeyPropertyConfig;
};

export type WorkspaceData = {
  id: number;
  geometry_id: number;
  name: string;
  description: string;
  active: boolean;
  created_at: string;
  plugins: KeyPlugin[];
  key_properties: KeyProperty[];
};
