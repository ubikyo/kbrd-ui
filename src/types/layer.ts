import type { FactoryLayout } from "./layout";

export type KeyPlugin = {
  id: number;
  layer_id: number;
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
  borderEnabled?: boolean;
  downEnabled: boolean;
  upBorderEnabled: boolean;
  downBorderEnabled: boolean;
  upBorderColor: string;
  downBorderColor: string;
  upBorderWidth: number;
  downBorderWidth: number;
  upBackgroundColor: string;
  downBackgroundColor: string;
};

export type KeyProperty = {
  key_ref: string;
  config: KeyPropertyConfig;
};

export type LayerData = {
  id: number;
  layout_id: number;
  name: string;
  description: string;
  active: boolean;
  created_at: string;
  plugins: KeyPlugin[];
  key_properties: KeyProperty[];
  // `<Factory>`'s own grid disposition (see `FactoryLayout`), persisted
  // alongside this layer and reloaded whenever it's switched back to —
  // `null` until something's actually been laid out on the display.
  factory_layout: FactoryLayout | null;
};
