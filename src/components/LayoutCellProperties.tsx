import { Stack, Text } from "@mantine/core";

import { pluginById } from "../plugins/registry";
import type { GridCell } from "../types/layout";

// Just the plugin-facing slice of a cell — matches `GridCell` and a
// division of a divided cell (`DivisionCell`) alike, since neither this
// component nor any `LayoutEditor` it renders ever reads `unit`,
// `pluginIds`, or (`GridCell` only) `divide`.
type PluginCell = Pick<GridCell, "typeId" | "typeConfig">;

type Props = {
  cell: PluginCell;
  onChange: (patch: Partial<PluginCell>) => void;
};

/**
 * Layout-mode Properties tab content for a selected `<Factory>` cell (or
 * division of a divided one): whatever its own Layout plugin
 * (kbrd.layout-key / kbrd.layout-space) exposes — its Unit is set by
 * dragging the cell's own resize handle in `<Factory>` instead, and
 * Merge/Unmerge/Divide/Remove now live in Factory's own top-right
 * Actions menu (see `App`) rather than here.
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
