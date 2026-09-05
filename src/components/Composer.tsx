import { Box, Menu, SegmentedControl, Switch, Text } from "@mantine/core";
import {
  MdAdd,
  MdCallMerge,
  MdCallSplit,
  MdContentCopy,
  MdContentPaste,
  MdDelete,
  MdEdit,
  MdGridOn,
} from "react-icons/md";
import { useState } from "react";

import type { DisplayGridApi } from "../classes/useDisplayGrid";
import type { EntityEditorsApi } from "../classes/useEntityEditors";
import { useLayoutShortcuts } from "../classes/useLayoutShortcuts";
import { useUndoHistory } from "../classes/useUndoHistory";
import type { LayerData } from "../types/layer";
import type { LayoutData, LayoutSettings } from "../types/layout";
import Display from "./Display";
import type { ContextMenuTarget } from "./Display";
import ConfirmationModal from "./modals/ConfirmationModal";
import DivideModal from "./modals/DivideModal";

// The Actions menu's own shortcuts are shown next to their label in
// whichever form this platform actually uses — ⌘ on macOS, Ctrl+
// elsewhere (both are accepted either way, see `useLayoutShortcuts`).
const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);
const MOD_KEY_LABEL = IS_MAC ? "⌘" : "Ctrl+";

function ShortcutHint({ children }: { children: React.ReactNode }) {
  return (
    <Text size="xs" c="dimmed">
      {children}
    </Text>
  );
}

type Props = {
  layoutSettings: LayoutSettings;
  mode: "layout" | "mapping";
  onModeChange: (mode: "layout" | "mapping") => void;
  layout: LayoutData | null;
  layer: LayerData | null;
  grid: DisplayGridApi;
  entityEditors: EntityEditorsApi;
  // Gates `useLayoutShortcuts`'s own shortcuts while Settings has its own
  // fields to type/tab through instead — `entityEditors` already carries
  // the equivalent flags for the Layout/Layer editors and the delete
  // confirmation, all three owned by `App` alongside Settings.
  settingsOpened: boolean;
};

/**
 * Everything around `<Display>`'s own SVG — the Layout/Mapping switch,
 * Resize, the right-click context menu (cell/division/row/display) and
 * Divide — plus the grid-editing keyboard shortcuts and undo history that
 * act on the same selection. `App` only ever hands this the display's own
 * settings, the current layout/layer (read-only, for a few menu items'
 * disabled state) and `useDisplayGrid`/`useEntityEditors`'s own handles;
 * everything about *how* the display reacts to a mode, a shortcut or a
 * menu click stays in here rather than in `App`.
 */
export default function Composer({
  layoutSettings,
  mode,
  onModeChange,
  layout,
  layer,
  grid,
  entityEditors,
  settingsOpened,
}: Props) {
  const [divideModalOpened, setDivideModalOpened] = useState(false);
  // The display's own right-click context menu — replaces the old floating
  // "Actions" button. `Display` reports where the cursor was and what it
  // landed on (already selected the same way a left click would by the
  // time this fires); only the position and which content to show
  // (`kind`) need to live here, since `grid`'s own selection state is
  // already the source of truth for *which* cell, division, row or the
  // display itself is the real target.
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    kind: ContextMenuTarget["kind"];
  } | null>(null);

  const { undo } = useUndoHistory({
    cells: grid.cells,
    rowOverrides: grid.rowOverrides,
    mergeGroups: grid.mergeGroups,
    skipAutosaveRef: grid.skipAutosaveRef,
    setCells: grid.setCells,
    setRowOverrides: grid.setRowOverrides,
    setMergeGroups: grid.setMergeGroups,
    clearCellSelection: grid.clearCellSelection,
  });

  const { resizeEnabled, setResizeEnabled } = useLayoutShortcuts({
    mode,
    settingsOpened,
    layoutEditorOpened: entityEditors.layoutEditorOpened,
    layerEditorOpened: entityEditors.layerEditorOpened,
    confirmDeleteOpen: Boolean(entityEditors.confirmDelete),
    divideModalOpened,
    hasCellSelection: grid.hasCellSelection,
    hasDivisionSelection: grid.hasDivisionSelection,
    canCopySelection: grid.canCopySelection,
    emptySelection: grid.emptySelection,
    canPaste: grid.canPaste,
    undo,
    deleteSelectedCells: grid.deleteSelectedCells,
    deleteSelectedDivisions: grid.deleteSelectedDivisions,
    copySelectedCell: grid.copySelectedCell,
    pasteToEmptyRow: grid.pasteToEmptyRow,
  });

  // `Display`'s `onContextMenu` — a right-click anywhere on the display.
  // `Display` has already made whatever selection this right-click
  // implies by the time this fires (preserving a multi-selection the
  // clicked cell/division was already part of, rather than always
  // collapsing it to just that one — see its own context-menu handlers),
  // so this only needs to open the menu itself, at the click.
  function handleContextMenu(x: number, y: number, target: ContextMenuTarget) {
    setContextMenu({ x, y, kind: target.kind });
  }

  return (
    <Box h="100%" style={{ position: "relative", overflow: "hidden" }}>
      {/* TODO(preview-rebuild): Display temporarily stands in for Preview
          while that component is redesigned from scratch. */}
      <Display
        {...layoutSettings}
        mode={mode}
        rows={grid.rows}
        cells={grid.cells}
        onCellsChange={grid.setCells}
        onCreateCell={grid.createCell}
        onAssignLayoutPlugin={grid.assignLayoutPlugin}
        onAssignLayoutPluginToDivision={grid.assignLayoutPluginToDivision}
        onMoveCell={grid.moveCell}
        mergeGroups={grid.mergeGroups}
        selectedCellIndices={grid.selectedCellIndices}
        onSelectCell={grid.selectCell}
        onToggleCell={grid.toggleCellSelection}
        selectedEmptyRow={grid.selectedEmptyRow}
        onSelectEmpty={grid.selectEmptyRow}
        selectedDivisionIndices={grid.selectedDivisionIndices}
        onSelectDivision={grid.selectDivision}
        onToggleDivision={grid.toggleDivisionSelection}
        isDisplaySelected={grid.displaySelected}
        onSelectDisplay={grid.selectDisplay}
        onContextMenu={handleContextMenu}
        resizeEnabled={resizeEnabled}
        maxColumns={layout?.max_columns ?? null}
      />

      <SegmentedControl
        value={mode}
        onChange={(value) => onModeChange(value === "mapping" ? "mapping" : "layout")}
        data={[
          { label: "Layout", value: "layout" },
          { label: "Mapping", value: "mapping" },
        ]}
        color="green"
        size="xs"
        style={{
          position: "absolute",
          left: 20,
          bottom: 20,
          zIndex: 20,
        }}
      />

      {/* Resizing is a view option, not a per-layout action, so it lives
          here as a persistent switch, aligned right at the same level as
          the Layout/Mapping switch on the left. Also toggled by Tab (see
          `useLayoutShortcuts`) — Layout mode only: Mapping mode has no
          row/cell structure to resize in the first place, so the switch
          (and whatever it was left at) is hidden rather than just
          disabled. */}
      {mode === "layout" && (
        <Switch
          label="Resize"
          size="xs"
          color="green"
          checked={resizeEnabled}
          onChange={(event) => setResizeEnabled(event.currentTarget.checked)}
          style={{
            position: "absolute",
            right: 20,
            bottom: 20,
            zIndex: 20,
          }}
        />
      )}

      {/* One shared right-click context menu (see `Display`'s
          `onContextMenu` and `handleContextMenu` above) — its content
          switches on `contextMenu.kind`, reading whichever selection
          `grid` already made for it the same way each used to feed its
          own floating "Actions" button. Anchored to an invisible,
          zero-size target positioned at the click itself instead of a
          fixed on-screen spot, so it opens right where the cursor was. */}
      {contextMenu && (
        <Menu
          opened
          onChange={(opened) => {
            if (!opened) setContextMenu(null);
          }}
          position="bottom-start"
          offset={0}
          width={200}
          styles={{ item: { padding: "4px var(--mantine-spacing-sm)" } }}
        >
          <Menu.Target>
            <div
              style={{
                position: "fixed",
                left: contextMenu.x,
                top: contextMenu.y,
                width: 0,
                height: 0,
              }}
            />
          </Menu.Target>
          <Menu.Dropdown>
            {contextMenu.kind === "cell" &&
              mode === "layout" &&
              grid.selectedCellIndices.length > 0 && (
                <>
                  {grid.selectedCellIndices.length === 1 &&
                    grid.layoutSelection && (
                      <>
                        {grid.layoutSelection.isMerged && (
                          <Menu.Item leftSection={<MdCallSplit />} onClick={grid.unmerge}>
                            Unmerge
                          </Menu.Item>
                        )}
                        {!grid.layoutSelection.isMerged &&
                          !grid.layoutSelection.cell.divide && (
                            <Menu.Item
                              leftSection={<MdGridOn />}
                              onClick={() => setDivideModalOpened(true)}
                            >
                              Divide
                            </Menu.Item>
                          )}
                        <Menu.Divider />
                        <Menu.Item
                          leftSection={<MdContentCopy />}
                          rightSection={<ShortcutHint>{MOD_KEY_LABEL}C</ShortcutHint>}
                          onClick={grid.copySelectedCell}
                        >
                          Copy
                        </Menu.Item>
                        {/* Applies onto this same cell — see
                            `canPaste`/`pasteToEmptyRow`: since it's the
                            exact cell just copied, that's never a
                            meaningful overwrite, so this lands a new
                            sibling in its row's own trailing empty space
                            instead, without first re-selecting that space
                            explicitly. A *different*, non-empty cell
                            would instead ask before overwriting it — see
                            `ConfirmationModal` below. */}
                        <Menu.Item
                          leftSection={<MdContentPaste />}
                          rightSection={<ShortcutHint>{MOD_KEY_LABEL}V</ShortcutHint>}
                          disabled={!grid.canPaste}
                          onClick={grid.pasteToEmptyRow}
                        >
                          Paste
                        </Menu.Item>
                        {grid.layoutSelection.canRemove && (
                          <Menu.Item
                            color="red"
                            leftSection={<MdDelete />}
                            rightSection={<ShortcutHint>⌫</ShortcutHint>}
                            onClick={() => grid.removeCell(grid.layoutSelection!.index)}
                          >
                            Delete
                          </Menu.Item>
                        )}
                      </>
                    )}
                  {grid.selectedCellIndices.length > 1 &&
                    grid.isCellSelectionContiguous && (
                      <>
                        <Menu.Item leftSection={<MdCallMerge />} onClick={grid.mergeSelectedCells}>
                          Merge
                        </Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<MdDelete />}
                          rightSection={<ShortcutHint>⌫</ShortcutHint>}
                          onClick={grid.deleteSelectedCells}
                        >
                          Delete
                        </Menu.Item>
                      </>
                    )}
                  {grid.selectedCellIndices.length > 1 &&
                    !grid.isCellSelectionContiguous && (
                      <Menu.Item
                        color="red"
                        leftSection={<MdDelete />}
                        rightSection={<ShortcutHint>⌫</ShortcutHint>}
                        onClick={grid.deleteSelectedCells}
                      >
                        Delete
                      </Menu.Item>
                    )}
                </>
              )}

            {contextMenu.kind === "division" &&
              mode === "layout" &&
              grid.selectedDivisionIndices.length > 0 && (
                <>
                  {grid.selectedDivisionIndices.length === 1 &&
                    grid.divisionSelection && (
                      <>
                        {grid.divisionSelection.isMerged && (
                          <Menu.Item leftSection={<MdCallSplit />} onClick={grid.unmergeDivision}>
                            Unmerge
                          </Menu.Item>
                        )}
                        {/* Applies directly onto this division — see
                            `canPaste`/`pasteToEmptyRow` — confirming
                            first (`pendingOverwrite`) if it isn't
                            already blank; divisions have no row of their
                            own to fall back to instead. */}
                        <Menu.Item
                          leftSection={<MdContentPaste />}
                          rightSection={<ShortcutHint>{MOD_KEY_LABEL}V</ShortcutHint>}
                          disabled={!grid.canPaste}
                          onClick={grid.pasteToEmptyRow}
                        >
                          Paste
                        </Menu.Item>
                        {grid.divisionSelection.cell.typeId && (
                          <Menu.Item
                            color="red"
                            leftSection={<MdDelete />}
                            rightSection={<ShortcutHint>⌫</ShortcutHint>}
                            onClick={grid.deleteSelectedDivisions}
                          >
                            Delete
                          </Menu.Item>
                        )}
                      </>
                    )}
                  {grid.selectedDivisionIndices.length > 1 &&
                    grid.isDivisionSelectionContiguous && (
                      <>
                        <Menu.Item
                          leftSection={<MdCallMerge />}
                          onClick={grid.mergeSelectedDivisions}
                        >
                          Merge
                        </Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<MdDelete />}
                          rightSection={<ShortcutHint>⌫</ShortcutHint>}
                          onClick={grid.deleteSelectedDivisions}
                        >
                          Delete
                        </Menu.Item>
                      </>
                    )}
                  {grid.selectedDivisionIndices.length > 1 &&
                    !grid.isDivisionSelectionContiguous && (
                      <Menu.Item
                        color="red"
                        leftSection={<MdDelete />}
                        rightSection={<ShortcutHint>⌫</ShortcutHint>}
                        onClick={grid.deleteSelectedDivisions}
                      >
                        Delete
                      </Menu.Item>
                    )}
                </>
              )}

            {contextMenu.kind === "row" && mode === "layout" && grid.emptySelection && (
              <Menu.Item
                leftSection={<MdContentPaste />}
                rightSection={<ShortcutHint>{MOD_KEY_LABEL}V</ShortcutHint>}
                disabled={!grid.emptySelection.canPaste}
                onClick={grid.pasteToEmptyRow}
              >
                Paste
              </Menu.Item>
            )}

            {contextMenu.kind === "display" && (
              <>
                <Menu.Label>Layout</Menu.Label>
                <Menu.Item leftSection={<MdAdd />} onClick={entityEditors.openAddLayout}>
                  Add
                </Menu.Item>
                <Menu.Item
                  leftSection={<MdEdit />}
                  disabled={!layout}
                  onClick={entityEditors.openEditLayout}
                >
                  Edit
                </Menu.Item>
                <Menu.Item
                  color="red"
                  leftSection={<MdDelete />}
                  disabled={!layout}
                  onClick={entityEditors.requestDeleteLayout}
                >
                  Delete
                </Menu.Item>
                <Menu.Divider />
                <Menu.Label>Layer</Menu.Label>
                <Menu.Item
                  leftSection={<MdAdd />}
                  disabled={!layout}
                  onClick={entityEditors.openAddLayer}
                >
                  Add
                </Menu.Item>
                <Menu.Item
                  leftSection={<MdEdit />}
                  disabled={!layer}
                  onClick={entityEditors.openEditLayer}
                >
                  Edit
                </Menu.Item>
                <Menu.Item
                  color="red"
                  leftSection={<MdDelete />}
                  disabled={!layer}
                  onClick={entityEditors.requestDeleteLayer}
                >
                  Delete
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      )}

      {divideModalOpened && grid.layoutSelection && (
        <DivideModal
          onClose={() => setDivideModalOpened(false)}
          onDivide={(cols, rows) => {
            grid.divideSelectedCell(cols, rows);
            setDivideModalOpened(false);
          }}
        />
      )}

      {/* Pasting, or dropping a Layout plugin, onto a cell/division that
          already has content asks first — see
          `pendingOverwrite`/`confirmOverwrite` in `useDisplayGrid`. */}
      {grid.pendingOverwrite && (
        <ConfirmationModal
          title="Delete"
          message="Delete the current content?"
          onConfirm={grid.confirmOverwrite}
          onCancel={grid.cancelOverwrite}
        />
      )}
    </Box>
  );
}
