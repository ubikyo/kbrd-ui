import { Stack, Text } from "@mantine/core";

import { pluginById } from "../plugins/registry";
import type { GridCell } from "../types/layout";

type Props = {
  cell: GridCell;
  onChange: (patch: Partial<GridCell>) => void;
};

/**
 * Layout-mode Properties tab content for a selected `<Factory>` cell:
 * whatever the cell's own Layout plugin (kbrd.layout-key /
 * kbrd.layout-space) exposes — its Unit is set by dragging the cell's own
 * resize handle in `<Factory>` instead, and Merge/Unmerge/Remove now live
 * in Factory's own top-right Actions menu (see `App`) rather than here.
 */
export default function LayoutCellProperties({ cell, onChange }: Props) {
  const type = cell.typeId ? pluginById(cell.typeId) : null;
  const TypeLayoutEditor = type?.LayoutEditor;

  return (
    <Stack gap="md">
      {type && TypeLayoutEditor ? (
        <>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {type.name}
          </Text>
          <TypeLayoutEditor
            config={cell.typeConfig}
            onChange={(config) => onChange({ typeConfig: config })}
          />
        </>
      ) : (
        <Text c="dimmed">Nothing to configure for this cell.</Text>
      )}
    </Stack>
  );
}
