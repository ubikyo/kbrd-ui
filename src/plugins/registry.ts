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

export type PluginDefinition = Omit<
  PluginModule,
  "LayoutEditor" | "MappingEditor" | "Renderer"
> & {
  LayoutEditor: ComponentType<PluginEditorProps>;
  MappingEditor: ComponentType<PluginEditorProps>;
  Renderer: ComponentType<PluginRendererProps>;
};

export const plugins = pluginModules as unknown as PluginDefinition[];

export const pluginById = (id: string) =>
  plugins.find((plugin) => plugin.id === id);

// A Layout plugin's own `capabilities` (`kbrd.layout-key`/`kbrd.layout-space`,
// see their own `plugin.json`) drive how a cell behaves in Mapping mode —
// see `Display`/`LayoutCellDivision`. `mapping-visible` is whether it still shows
// at all there (Key does, Space doesn't: hidden entirely, though its own
// row/grid space stays reserved); `mapping-target` is whether an
// Invoke/Display plugin can be dropped onto it. Both default to `false`
// for a cell with no `typeId` yet, or a `typeId` the registry doesn't
// recognize.
export const isMappingVisible = (typeId: string | null | undefined) =>
  Boolean(
    typeId && pluginById(typeId)?.capabilities.includes("mapping-visible"),
  );

export const isMappingTarget = (typeId: string | null | undefined) =>
  Boolean(
    typeId && pluginById(typeId)?.capabilities.includes("mapping-target"),
  );
