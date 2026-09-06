import { useState } from "react";
import { Box, Button, Group, Modal, Select, Stack, Text } from "@mantine/core";

type Item = { id: number; name: string };

type Props = {
  kind: "layout" | "layer";
  // Every existing Layout/Layer — `currentId` (the one about to overwrite
  // another) is filtered out below, since replacing itself makes no sense.
  items: Item[];
  currentId: number | null;
  onClose: () => void;
  // Only picks *which* one — the actual overwrite still confirms
  // separately (see `useEntityEditors`'s own `pendingReplace`/
  // `Confirmation`).
  onPick: (target: Item) => void;
};

/** "Replace with current" — picks an existing Layout/Layer (any but the
 * current one) whose content the current one will overwrite. */
export default function ReplaceEntity({
  kind,
  items,
  currentId,
  onClose,
  onPick,
}: Props) {
  const candidates = items.filter((item) => item.id !== currentId);
  const [targetId, setTargetId] = useState<string | null>(
    candidates[0] ? String(candidates[0].id) : null,
  );

  return (
    <Modal
      opened
      onClose={onClose}
      title={<Text fw={700}>Replace {kind}</Text>}
      centered
      size="sm"
      overlayProps={{ backgroundOpacity: 0.65, blur: 2 }}
      styles={{ body: { padding: 0 } }}
    >
      <Box style={{ padding: "24px 40px 40px" }}>
        <Stack>
          {candidates.length === 0 ? (
            <Text c="dimmed">No other {kind} to replace.</Text>
          ) : (
            <Select
              variant="filled"
              label={`Destination ${kind}`}
              data={candidates.map((item) => ({
                value: String(item.id),
                label: item.name,
              }))}
              value={targetId}
              onChange={setTargetId}
              allowDeselect={false}
            />
          )}
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
        <Button
          color="red"
          disabled={!targetId}
          onClick={() => {
            const target = candidates.find(
              (item) => String(item.id) === targetId,
            );
            if (target) onPick(target);
          }}
        >
          Next
        </Button>
      </Group>
    </Modal>
  );
}
