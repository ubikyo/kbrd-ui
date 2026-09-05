import { useState } from "react";

import {
  deleteKeyPlugin,
  updateKeyPlugin,
  updateKeyProperties,
} from "../api/layers";
import { pluginById, plugins } from "../plugins/registry";
import type { KeyboardLayout } from "../types/layout";
import {
  BACKGROUND_REF,
  type KeyPlugin,
  type KeyProperty,
  type KeyPropertyConfig,
  type LayerData,
} from "../types/layer";
import { resolveBorderEnabled, resolveBorderWidth } from "../utils/keyProperties";
import { usePendingSaves } from "../utils/usePendingSaves";
import { DEFAULT_KEY_PROPERTIES } from "./inspectorHelpers";

/**
 * Everything behind `<Inspector>`'s Plugins/Properties tabs for
 * `selectedKey`: which plugin instances/properties it has, the system
 * "Key"/"Space"/"Layer" properties row every key shows regardless of its
 * own plugins, and every mutation (patch/reorder/remove/clear/move) —
 * each one optimistically updating `layer` through the callbacks passed
 * in (`onChange`/`onKeyPropertiesChange`) before its own debounced save
 * actually reaches KBRD-API (see `usePendingSaves`).
 */
export function useKeyInspector(params: {
  layer: LayerData | null;
  selectedKey: string | null;
  layout: KeyboardLayout | null;
  mode: "layout" | "mapping";
  onChange: (plugins: KeyPlugin[]) => void;
  onKeyPropertiesChange: (properties: KeyProperty[]) => void;
  onPreviewDownPluginChange: (pluginId: number | null) => void;
  onPreviewDownTargetChange: (keyRef: string | null) => void;
  onMoveTo: () => void;
  onClearAll: () => Promise<void>;
}) {
  const {
    layer,
    selectedKey,
    layout,
    mode,
    onChange,
    onKeyPropertiesChange,
    onPreviewDownPluginChange,
    onPreviewDownTargetChange,
    onMoveTo,
    onClearAll,
  } = params;

  const [propertyStates, setPropertyStates] = useState<
    Record<number, "main" | "up" | "down">
  >({});
  const [deleting, setDeleting] = useState<KeyPlugin | null>(null);
  const [clearing, setClearing] = useState(false);
  const [targetStates, setTargetStates] = useState<
    Record<string, "option" | "up" | "down">
  >({});
  const [dropIndicator, setDropIndicator] = useState<{
    id: number;
    edge: "before" | "after";
  } | null>(null);
  const [draggedPropertyId, setDraggedPropertyId] = useState<number | null>(
    null,
  );
  const pendingSaves = usePendingSaves<number, Partial<KeyPlugin>>();
  const pendingPropertySaves = usePendingSaves<string, KeyPropertyConfig>();

  // Layout plugins (positioning/kind) are only draggable in Layout mode;
  // Invoke/Display plugins (behaviour/content) only in Mapping mode.
  const draggablePlugins = plugins.filter((plugin) =>
    mode === "layout"
      ? plugin.category === "Layout"
      : plugin.category !== "Layout",
  );
  const pluginCategories = [
    ...new Set(draggablePlugins.map((plugin) => plugin.category)),
  ];
  const allInstances = layer?.plugins ?? [];
  const instances = allInstances
    .filter((plugin) => plugin.key_ref === selectedKey)
    .sort((left, right) => left.position - right.position);
  const propertyGroups = [...new Set(plugins.map((plugin) => plugin.category))]
    .map((category) => ({
      category,
      items: instances.filter(
        (item) => pluginById(item.plugin_id)?.category === category,
      ),
    }))
    .filter((group) => group.items.length > 0);
  const keyProperties = layer?.key_properties ?? [];
  const selectedProperty = keyProperties.find(
    (property) => property.key_ref === selectedKey,
  );
  const propertyConfig: KeyPropertyConfig = {
    ...DEFAULT_KEY_PROPERTIES,
    ...selectedProperty?.config,
    upBorderWidth: resolveBorderWidth(selectedProperty?.config, false),
    downBorderWidth: resolveBorderWidth(selectedProperty?.config, true),
    upBorderEnabled: resolveBorderEnabled(selectedProperty?.config, false),
    downBorderEnabled: resolveBorderEnabled(selectedProperty?.config, true),
  };
  const targetType: "key" | "space" | "background" =
    selectedKey === BACKGROUND_REF
      ? "background"
      : (layout?.keys.find((key) => key.ref === selectedKey)?.type ?? "key");
  const storedTargetState = selectedKey
    ? (targetStates[selectedKey] ?? "option")
    : "option";
  const targetState =
    targetType !== "key" && storedTargetState === "down"
      ? "up"
      : storedTargetState;
  const systemPluginName =
    targetType === "background"
      ? "Layer"
      : targetType === "space"
        ? "Space"
        : "Key";

  function patchKeyProperty(data: Partial<KeyPropertyConfig>) {
    if (!layer || !selectedKey) return;
    const config = { ...propertyConfig, ...data };
    const property = { key_ref: selectedKey, config };
    onKeyPropertiesChange([
      ...keyProperties.filter((item) => item.key_ref !== selectedKey),
      property,
    ]);
    pendingPropertySaves.schedule(
      selectedKey,
      () => config,
      (saved) => void updateKeyProperties(layer.id, selectedKey, saved),
    );
  }

  function patch(item: KeyPlugin, data: Partial<KeyPlugin>) {
    const value = { ...item, ...data };
    onChange(
      allInstances.map((plugin) => (plugin.id === value.id ? value : plugin)),
    );

    pendingSaves.schedule(
      item.id,
      (previous) => ({ ...previous, ...data }),
      (merged) => void updateKeyPlugin(item.id, merged),
    );
  }

  async function reorder(
    draggedId: number,
    targetId: number,
    edge: "before" | "after",
  ) {
    const draggedItem = instances.find((item) => item.id === draggedId);
    const targetItem = instances.find((item) => item.id === targetId);
    if (!draggedItem || !targetItem || draggedId === targetId) return;
    const category = pluginById(draggedItem.plugin_id)?.category;
    if (!category || pluginById(targetItem.plugin_id)?.category !== category) {
      return;
    }

    const categoryInstances = instances.filter(
      (item) => pluginById(item.plugin_id)?.category === category,
    );
    const from = categoryInstances.findIndex((item) => item.id === draggedId);

    const positions = categoryInstances.map((item) => item.position);
    const reordered = [...categoryInstances];
    const [dragged] = reordered.splice(from, 1);
    const targetIndex = reordered.findIndex((item) => item.id === targetId);
    if (targetIndex === -1) return;
    reordered.splice(targetIndex + (edge === "after" ? 1 : 0), 0, dragged);
    if (
      reordered.every(
        (item, index) => item.id === categoryInstances[index].id,
      )
    ) {
      return;
    }
    const positioned = reordered.map((item, index) => ({
      ...item,
      position: positions[index],
    }));

    const reorderedById = new Map(positioned.map((item) => [item.id, item]));
    onChange(allInstances.map((item) => reorderedById.get(item.id) ?? item));
    await Promise.all(
      positioned
        .filter(
          (item) =>
            categoryInstances.find((instance) => instance.id === item.id)
              ?.position !== item.position,
        )
        .map((item) => updateKeyPlugin(item.id, { position: item.position })),
    );
  }

  async function remove(item: KeyPlugin) {
    const pending = pendingSaves.take(item.id);
    onChange(allInstances.filter((plugin) => plugin.id !== item.id));
    if (pending) await updateKeyPlugin(item.id, pending);
    await deleteKeyPlugin(item.id);
    onPreviewDownPluginChange(null);
    setDeleting(null);
  }

  async function clearAll() {
    if (!selectedKey) return;
    pendingPropertySaves.take(selectedKey);
    for (const instance of instances) {
      pendingSaves.take(instance.id);
    }
    await onClearAll();
    onPreviewDownPluginChange(null);
    onPreviewDownTargetChange(null);
    setClearing(false);
  }

  async function startMoveTo() {
    if (!layer || !selectedKey) return;
    const saves: Promise<unknown>[] = [];
    if (pendingPropertySaves.take(selectedKey)) {
      saves.push(updateKeyProperties(layer.id, selectedKey, propertyConfig));
    }
    for (const instance of instances) {
      const pending = pendingSaves.take(instance.id);
      if (pending) saves.push(updateKeyPlugin(instance.id, pending));
    }
    await Promise.all(saves);
    onMoveTo();
  }

  return {
    // UI-only state
    propertyStates,
    setPropertyStates,
    deleting,
    setDeleting,
    clearing,
    setClearing,
    targetStates,
    setTargetStates,
    dropIndicator,
    setDropIndicator,
    draggedPropertyId,
    setDraggedPropertyId,

    // derived data
    draggablePlugins,
    pluginCategories,
    allInstances,
    instances,
    propertyGroups,
    propertyConfig,
    targetType,
    targetState,
    systemPluginName,

    // mutations
    patchKeyProperty,
    patch,
    reorder,
    remove,
    clearAll,
    startMoveTo,
  };
}
