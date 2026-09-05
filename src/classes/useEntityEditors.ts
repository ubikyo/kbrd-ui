import { useRef, useState } from "react";

import type { LayerMenuHandle } from "../components/Layer";
import type { LayoutMenuHandle } from "../components/Layout";
import { deleteLayout } from "../api/layouts";
import { deleteLayer } from "../api/layers";
import type { LayerData } from "../types/layer";
import type { LayoutData } from "../types/layout";

/**
 * Add/Edit/Delete for the current Layout and Layer — the modal-opening
 * and delete-confirmation plumbing behind `<Display>`'s own display
 * Actions menu (see `App`'s context menu). Both entities share the same
 * shape of interaction (an editor modal, a shared delete-confirmation
 * dialog keyed by `kind`), so this owns both rather than duplicating the
 * pattern in two separate hooks.
 */
export function useEntityEditors(params: {
  layout: LayoutData | null;
  layer: LayerData | null;
}) {
  const { layout, layer } = params;

  const layoutMenuRef = useRef<LayoutMenuHandle>(null);
  const layerMenuRef = useRef<LayerMenuHandle>(null);
  const [layoutEditorOpened, setLayoutEditorOpened] = useState(false);
  const [editingLayout, setEditingLayout] = useState<LayoutData | null>(null);
  const [layerEditorOpened, setLayerEditorOpened] = useState(false);
  const [editingLayer, setEditingLayer] = useState<LayerData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: "layout" | "layer";
    id: number;
    name: string;
  } | null>(null);

  function openAddLayout() {
    setEditingLayout(null);
    setLayoutEditorOpened(true);
  }

  function openEditLayout() {
    if (!layout) return;
    setEditingLayout(layout);
    setLayoutEditorOpened(true);
  }

  function requestDeleteLayout() {
    if (!layout) return;
    setConfirmDelete({ kind: "layout", id: layout.id, name: layout.name });
  }

  function openAddLayer() {
    if (!layout) return;
    setEditingLayer(null);
    setLayerEditorOpened(true);
  }

  function openEditLayer() {
    if (!layer) return;
    setEditingLayer(layer);
    setLayerEditorOpened(true);
  }

  function requestDeleteLayer() {
    if (!layer) return;
    setConfirmDelete({ kind: "layer", id: layer.id, name: layer.name });
  }

  async function confirmDeleteNow() {
    if (!confirmDelete) return;
    if (confirmDelete.kind === "layout") {
      await deleteLayout(confirmDelete.id);
      setConfirmDelete(null);
      await layoutMenuRef.current?.refresh();
    } else {
      await deleteLayer(confirmDelete.id);
      setConfirmDelete(null);
      await layerMenuRef.current?.refresh();
    }
  }

  return {
    layoutMenuRef,
    layerMenuRef,
    layoutEditorOpened,
    setLayoutEditorOpened,
    editingLayout,
    layerEditorOpened,
    setLayerEditorOpened,
    editingLayer,
    confirmDelete,
    setConfirmDelete,
    openAddLayout,
    openEditLayout,
    requestDeleteLayout,
    openAddLayer,
    openEditLayer,
    requestDeleteLayer,
    confirmDeleteNow,
  };
}

export type EntityEditorsApi = ReturnType<typeof useEntityEditors>;
