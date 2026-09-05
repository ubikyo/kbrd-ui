import { useEffect, useRef, useState } from "react";

/**
 * Every global keyboard shortcut Layout mode responds to, independent of
 * whatever's focused: Tab toggles "Resize" (see `resizeEnabled`),
 * Cmd/Ctrl+Z undoes the last edit, Backspace deletes whatever's selected,
 * Cmd/Ctrl+C copies a cell, Cmd/Ctrl+V pastes into empty space. Both
 * effects skip firing while a modal has its own fields to type/tab
 * through, or while the user is typing into a text field somewhere else
 * (a plugin's config, a name field…) rather than working the display.
 *
 * The keydown handler itself is read through a ref (`shortcutsRef`)
 * rather than listed as an effect dependency, so the `window` listener is
 * attached once on mount, not re-subscribed on every render this hook's
 * many inputs change.
 */
export function useLayoutShortcuts(params: {
  mode: "layout" | "mapping";
  settingsOpened: boolean;
  layoutEditorOpened: boolean;
  layerEditorOpened: boolean;
  confirmDeleteOpen: boolean;
  divideModalOpened: boolean;
  hasCellSelection: boolean;
  hasDivisionSelection: boolean;
  canCopySelection: boolean;
  emptySelection: { canPaste: boolean } | null;
  // Whether Cmd/Ctrl+V has anywhere to land right now — the selected
  // empty row, or the sole selected cell's own row (see `useDisplayGrid`'s
  // `canPasteAfterSelection`), so Copy then Paste can round-trip onto the
  // same cell's row without re-selecting its trailing space first.
  canPaste: boolean;
  undo: () => void;
  deleteSelectedCells: () => void;
  deleteSelectedDivisions: () => void;
  copySelectedCell: () => void;
  pasteToEmptyRow: () => void;
}) {
  const {
    mode,
    settingsOpened,
    layoutEditorOpened,
    layerEditorOpened,
    confirmDeleteOpen,
    divideModalOpened,
    hasCellSelection,
    hasDivisionSelection,
    canCopySelection,
    emptySelection,
    canPaste,
    undo,
    deleteSelectedCells,
    deleteSelectedDivisions,
    copySelectedCell,
    pasteToEmptyRow,
  } = params;

  const [resizeEnabled, setResizeEnabled] = useState(false);

  // Tab toggles Resize — a global shortcut, independent of mode/selection —
  // except while a modal has its own fields to tab through normally, or
  // while typing in a text field, where Tab must keep doing its normal job.
  useEffect(() => {
    if (settingsOpened || layoutEditorOpened || layerEditorOpened || confirmDeleteOpen) {
      return;
    }
    function handleTab(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setResizeEnabled((current) => !current);
    }
    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [settingsOpened, layoutEditorOpened, layerEditorOpened, confirmDeleteOpen]);

  const anyModalOpen = Boolean(
    settingsOpened ||
      layoutEditorOpened ||
      layerEditorOpened ||
      confirmDeleteOpen ||
      divideModalOpened,
  );
  const shortcutsRef = useRef({
    mode,
    anyModalOpen,
    hasCellSelection,
    hasDivisionSelection,
    canCopySelection,
    emptySelection,
    canPaste,
    undo,
    deleteSelectedCells,
    deleteSelectedDivisions,
    copySelectedCell,
    pasteToEmptyRow,
  });
  useEffect(() => {
    shortcutsRef.current = {
      mode,
      anyModalOpen,
      hasCellSelection,
      hasDivisionSelection,
      canCopySelection,
      emptySelection,
      canPaste,
      undo,
      deleteSelectedCells,
      deleteSelectedDivisions,
      copySelectedCell,
      pasteToEmptyRow,
    };
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const {
        mode,
        anyModalOpen,
        hasCellSelection,
        hasDivisionSelection,
        canCopySelection,
        emptySelection,
        canPaste,
        undo,
        deleteSelectedCells,
        deleteSelectedDivisions,
        copySelectedCell,
        pasteToEmptyRow,
      } = shortcutsRef.current;
      const target = event.target as HTMLElement | null;
      const isTyping = Boolean(
        target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable),
      );
      // Cmd/Ctrl+Z — independent of `mode`/selection (unlike every other
      // shortcut below), but still not while a modal has its own fields
      // to undo through normally, or while typing anywhere else.
      if (
        !anyModalOpen &&
        !isTyping &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "z"
      ) {
        event.preventDefault();
        undo();
        return;
      }
      if (
        mode !== "layout" ||
        isTyping ||
        (!hasCellSelection && !hasDivisionSelection && !emptySelection)
      ) {
        return;
      }
      const withModifier = event.metaKey || event.ctrlKey;
      // A division being the real focus must win here — otherwise
      // Backspace would fall through to `deleteSelectedCells` and delete
      // the whole divided cell, every other division along with it,
      // rather than just clearing the selected one(s)' own plugin (a
      // division can never be removed on its own, only cleared).
      if (event.key === "Backspace" && hasDivisionSelection) {
        event.preventDefault();
        deleteSelectedDivisions();
      } else if (event.key === "Backspace" && hasCellSelection) {
        event.preventDefault();
        deleteSelectedCells();
      } else if (
        canCopySelection &&
        withModifier &&
        event.key.toLowerCase() === "c"
      ) {
        event.preventDefault();
        copySelectedCell();
      } else if (withModifier && event.key.toLowerCase() === "v") {
        if (canPaste) {
          event.preventDefault();
          pasteToEmptyRow();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { resizeEnabled, setResizeEnabled };
}
