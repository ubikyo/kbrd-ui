import type { ComponentType } from "react";
import { plugins as pluginModules } from "@kbrd/plugins/web";

export type PluginEditorProps = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  disabled?: boolean;
  targetType?: "key" | "background" | "space";
};

export type PluginRendererProps = {
  config: Record<string, unknown>;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PluginModule = (typeof pluginModules)[number];

export type PluginDefinition = Omit<PluginModule, "Editor" | "Renderer"> & {
  Editor: ComponentType<PluginEditorProps>;
  Renderer: ComponentType<PluginRendererProps>;
};

export const plugins = pluginModules as unknown as PluginDefinition[];

export const pluginById = (id: string) =>
  plugins.find((plugin) => plugin.id === id);
