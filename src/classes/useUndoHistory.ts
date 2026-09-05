import { useEffect, useRef } from "react";

import type { FactoryLayout, GridCell, MergeGroups } from "../types/layout";

// How many past `FactoryLayout` snapshots Cmd/Ctrl+Z can step back
// through. Capped so a long editing session's own history doesn't grow
// unbounded.
const MAX_UNDO_HISTORY = 100;

/**
 * Cmd/Ctrl+Z's own undo history for `<Display>`'s grid — every past
 * `FactoryLayout` (before whatever change just landed), pushed by an
 * effect that shares `useDisplayGrid`'s own "was this just a layer/layout
 * load, not a real edit" flag (`skipAutosaveRef`) so switching layer/
 * layout doesn't get recorded as an undo step. `previousFactoryLayoutRef`
 * is that effect's own memory of the last state it saw, so it always
 * pushes the state a change is *leaving*, not the one it's arriving at.
 * `isUndoingRef` marks a change `undo` itself just made, so that pass
 * doesn't turn around and push the very state undo just popped back onto
 * the stack.
 *
 * Must run before `App`'s own autosave-to-server effect — both key off
 * the same `skipAutosaveRef`, and this one's job is to record the state
 * that effect's *own* run is about to leave, before that effect's check
 * resets the flag back to `false`. In practice that just means calling
 * this hook before that effect, the same order they ran in as two
 * `useEffect`s in `App` before this was pulled out.
 */
export function useUndoHistory(params: {
  cells: Record<number, GridCell>;
  rowOverrides: Record<number, number[]>;
  mergeGroups: MergeGroups;
  skipAutosaveRef: React.RefObject<boolean>;
  setCells: (value: Record<number, GridCell>) => void;
  setRowOverrides: (value: Record<number, number[]>) => void;
  setMergeGroups: (value: MergeGroups) => void;
  clearCellSelection: () => void;
}) {
  const {
    cells,
    rowOverrides,
    mergeGroups,
    skipAutosaveRef,
    setCells,
    setRowOverrides,
    setMergeGroups,
    clearCellSelection,
  } = params;

  const undoStackRef = useRef<FactoryLayout[]>([]);
  const previousFactoryLayoutRef = useRef<FactoryLayout | null>(null);
  const isUndoingRef = useRef(false);

  useEffect(() => {
    const next: FactoryLayout = { rowOverrides, cells, mergeGroups };
    const previous = previousFactoryLayoutRef.current;
    if (previous && !skipAutosaveRef.current && !isUndoingRef.current) {
      undoStackRef.current.push(previous);
      if (undoStackRef.current.length > MAX_UNDO_HISTORY) {
        undoStackRef.current.shift();
      }
    }
    isUndoingRef.current = false;
    previousFactoryLayoutRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, rowOverrides, mergeGroups]);

  // Steps the grid back to whatever `FactoryLayout` it had right before
  // its most recent edit. Clears the current cell/division/row selection
  // rather than trying to carry it forward onto a disposition it may no
  // longer make sense for (a selected cell the undone edit removed, say).
  function undo() {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    isUndoingRef.current = true;
    setRowOverrides(previous.rowOverrides);
    setCells(previous.cells);
    setMergeGroups(previous.mergeGroups);
    clearCellSelection();
  }

  return { undo };
}
