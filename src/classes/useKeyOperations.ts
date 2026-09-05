import { useRef, useState } from "react";

import { clearKey } from "../api/layers";
import type { LayerData } from "../types/layer";

export type KeyOperation = {
  direction: "from" | "to" | "move";
  key: string;
};

/**
 * The Inspector's "Duplicate from" / "Duplicate to" / "Move to" flow for
 * `selectedKey` — shown as a dismissible notification in `App` while one
 * is in progress (see `keyOperation`) — plus "Clear all", which needs no
 * such multi-step flow of its own. `keyOperationRef` mirrors `keyOperation`
 * for `App`'s keydown-independent uses (currently none read it directly,
 * but it exists so a future consumer can read the operation mid-render
 * without depending on the state and re-rendering off it).
 */
export function useKeyOperations(params: {
  layer: LayerData | null;
  selectedKey: string | null;
  setLayer: (value: LayerData | null) => void;
  onPreviewDownPluginChange: (pluginId: number | null) => void;
  onPreviewDownTargetChange: (keyRef: string | null) => void;
}) {
  const { layer, selectedKey, setLayer, onPreviewDownPluginChange, onPreviewDownTargetChange } =
    params;

  const [keyOperation, setKeyOperation] = useState<KeyOperation | null>(null);
  const keyOperationRef = useRef<KeyOperation | null>(null);

  function stopKeyOperation() {
    keyOperationRef.current = null;
    setKeyOperation(null);
  }

  function startDuplicateFrom() {
    if (!selectedKey) return;
    const operation: KeyOperation = { direction: "from", key: selectedKey };
    keyOperationRef.current = operation;
    setKeyOperation(operation);
  }

  function startDuplicateTo() {
    if (!selectedKey) return;
    const operation: KeyOperation = { direction: "to", key: selectedKey };
    keyOperationRef.current = operation;
    setKeyOperation(operation);
  }

  function startMoveTo() {
    if (!selectedKey) return;
    const operation: KeyOperation = { direction: "move", key: selectedKey };
    keyOperationRef.current = operation;
    setKeyOperation(operation);
  }

  async function clearSelectedKey() {
    if (!layer || !selectedKey) return;
    const value = await clearKey(layer.id, selectedKey);
    setLayer(value);
    onPreviewDownPluginChange(null);
    onPreviewDownTargetChange(null);
  }

  return {
    keyOperation,
    stopKeyOperation,
    startDuplicateFrom,
    startDuplicateTo,
    startMoveTo,
    clearSelectedKey,
  };
}
