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

export type KeyMode = "momentary" | "toggle";

export type KeyPropertyConfig = {
  keyMode: KeyMode;
  borderEnabled: boolean;
  downEnabled: boolean;
  upBorderColor: string;
  downBorderColor: string;
  upBorderWidth: number;
  downBorderWidth: number;
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
