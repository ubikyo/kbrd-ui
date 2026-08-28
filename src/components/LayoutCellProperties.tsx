import { NumberInput, Select, Stack, Text } from "@mantine/core";
import { PropertyRow } from "@kbrd/plugins/web";

import { pluginById } from "../plugins/registry";
import { UNIT_MULTIPLIERS, type GridCell } from "../types/layout";

type Props = {
  cell: GridCell;
  maxColspan: number;
  maxRowspan: number;
  // True when this is the slot a row's Unit budget runs out on — its width
  // is always whatever's left over, not something it can set itself.
  isRemainder: boolean;
  onChange: (patch: Partial<GridCell>) => void;
};

/**
 * Layout-mode Properties tab content for a selected `<Factory>` cell: its
 * Unit/Colspan/Rowspan, then — below — whatever the cell's own Layout
 * plugin (kbrd.layout-key / kbrd.layout-space) exposes.
 */
export default function LayoutCellProperties({
  cell,
  maxColspan,
  maxRowspan,
  isRemainder,
  onChange,
}: Props) {
  const type = cell.typeId ? pluginById(cell.typeId) : null;
  const TypeLayoutEditor = type?.LayoutEditor;

  return (
    <Stack gap="md">
      <PropertyRow
        label="Unit"
        description={
          isRemainder
            ? "Fills whatever's left of the row — not set on this cell."
            : undefined
        }
      >
        <Select
          w="100%"
          aria-label="Unit"
          size="xs"
          allowDeselect={false}
          disabled={isRemainder}
          data={UNIT_MULTIPLIERS.map((value) => ({
            value: String(value),
            label: `${value}U`,
          }))}
          value={String(cell.unit)}
          success={!isRemainder}
          onChange={(value) => {
            const parsed = UNIT_MULTIPLIERS.find(
              (candidate) => String(candidate) === value,
            );
            if (parsed !== undefined) onChange({ unit: parsed });
          }}
        />
      </PropertyRow>
      <PropertyRow label="Colspan">
        <NumberInput
          w="100%"
          aria-label="Colspan"
          size="xs"
          min={1}
          max={maxColspan}
          allowDecimal={false}
          clampBehavior="strict"
          disabled={isRemainder || maxColspan <= 1}
          value={cell.colspan}
          success={!isRemainder && maxColspan > 1}
          onChange={(value) =>
            onChange({ colspan: typeof value === "number" ? value : 1 })
          }
        />
      </PropertyRow>
      <PropertyRow label="Rowspan">
        <NumberInput
          w="100%"
          aria-label="Rowspan"
          size="xs"
          min={1}
          max={maxRowspan}
          allowDecimal={false}
          clampBehavior="strict"
          disabled={maxRowspan <= 1}
          value={cell.rowspan}
          success={maxRowspan > 1}
          onChange={(value) =>
            onChange({ rowspan: typeof value === "number" ? value : 1 })
          }
        />
      </PropertyRow>

      {type && TypeLayoutEditor && (
        <>
          <Text size="xs" fw={600} c="dimmed" mt="md" tt="uppercase">
            {type.name}
          </Text>
          <TypeLayoutEditor
            config={cell.typeConfig}
            onChange={(config) => onChange({ typeConfig: config })}
          />
        </>
      )}
    </Stack>
  );
}
