import { Box, Stack, Text } from "@mantine/core";
import type { DragEvent } from "react";

import { pluginById } from "../plugins/registry";

type Props = {
  width: number;
  height: number;
  // Plugin id of the attached kbrd.layout-key / kbrd.layout-space instance,
  // or null when this cell hasn't been assigned a kind yet.
  typeId?: string | null;
  // Invoke/Display plugins attached in Mapping mode (only meaningful once
  // `typeId` is kbrd.layout-key).
  pluginIds?: string[];
  isDropTarget?: boolean;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
};

/** One item in the grid `<Factory>` lays out over the display, and a drop
 * target for the plugins dragged from `<Inspector>`'s Plugins tab. */
export default function LayoutItem({
  width,
  height,
  typeId = null,
  pluginIds = [],
  isDropTarget = false,
  onDragOver,
  onDragLeave,
  onDrop,
}: Props) {
  const type = typeId ? pluginById(typeId) : null;

  return (
    <Box
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        width,
        height,
        boxSizing: "border-box",
        border: `1px dashed ${
          isDropTarget ? "var(--kbrd-border-alt)" : "var(--kbrd-border-color)"
        }`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {type && (
        <Stack gap={0} align="center" style={{ pointerEvents: "none" }}>
          <Text size="xs" c="dimmed" truncate>
            {type.name}
          </Text>
          {pluginIds.map((pluginId) => {
            const plugin = pluginById(pluginId);
            return plugin ? (
              <Text key={pluginId} size="xs" truncate>
                {plugin.name}
              </Text>
            ) : null;
          })}
        </Stack>
      )}
    </Box>
  );
}
