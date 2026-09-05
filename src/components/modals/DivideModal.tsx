import { useState } from "react";
import { Box, Button, Group, Modal, NumberInput, Stack, Text } from "@mantine/core";

type Props = {
  onClose: () => void;
  // Divides the selected cell into `cols` × `rows` equal, gap-less
  // divisions — see `createDivideGrid`.
  onDivide: (cols: number, rows: number) => void;
};

type FieldRowProps = {
  label: string;
  children: React.ReactNode;
};

// Same 40/60 label/control split as `LayoutEditorModal`/`SettingsModal`'s
// own fields — each defines this locally rather than sharing one, so this
// follows suit rather than introducing a new shared component on its own.
function FieldRow({ label, children }: FieldRowProps) {
  return (
    <Box
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 4fr) minmax(0, 6fr)",
        columnGap: "var(--mantine-spacing-md)",
        alignItems: "center",
      }}
    >
      <Text size="sm">{label}</Text>
      {children}
    </Box>
  );
}

/** "Divide" in a cell's context menu: splits it into a `cols` × `rows`
 * grid of independent, gap-less divisions (see `createDivideGrid`) —
 * division `0` keeps the cell's own plugin, every other one starts blank
 * — see `App`'s `divideSelectedCell`. */
export default function DivideModal({ onClose, onDivide }: Props) {
  const [cols, setCols] = useState(1);
  const [rows, setRows] = useState(1);

  // A blank/zero/negative input still counts as "1 division on that
  // axis" rather than a bogus value the dialog would otherwise let
  // through.
  const safeCols = Math.max(1, Math.round(cols) || 1);
  const safeRows = Math.max(1, Math.round(rows) || 1);
  // 1×1 would divide the cell into a single division the same size as
  // the whole cell — no visible change, but it *would* replace the
  // cell's own Actions (Copy/Paste/Delete/Merge-with-a-neighbour) with
  // the division's much narrower Merge/Unmerge, permanently, since
  // there's no "Undivide" back out (see `App`'s `divideSelectedCell`).
  // Disabled rather than silently letting that footgun through.
  const isNoOp = safeCols * safeRows <= 1;

  function submit() {
    if (isNoOp) return;
    onDivide(safeCols, safeRows);
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={<Text fw={700}>Divide cell</Text>}
      centered
      size="sm"
      overlayProps={{ backgroundOpacity: 0.65, blur: 2 }}
      styles={{ body: { padding: 0 } }}
    >
      <Box style={{ padding: "24px 40px 40px" }}>
        <Stack>
          <FieldRow label="Width divisions">
            <NumberInput
              w="100%"
              aria-label="Width divisions"
              min={1}
              step={1}
              value={cols}
              success
              onChange={(value) => setCols(typeof value === "number" ? value : 1)}
            />
          </FieldRow>
          <FieldRow label="Height divisions">
            <NumberInput
              w="100%"
              aria-label="Height divisions"
              min={1}
              step={1}
              value={rows}
              success
              onChange={(value) => setRows(typeof value === "number" ? value : 1)}
            />
          </FieldRow>
        </Stack>
      </Box>

      <Group
        justify="flex-end"
        p="md"
        style={{ borderTop: "1px solid var(--kbrd-border-color)" }}
      >
        <Button color="gray" onClick={onClose}>
          Cancel
        </Button>
        <Button color="green" onClick={submit} disabled={isNoOp}>
          Divide
        </Button>
      </Group>
    </Modal>
  );
}
