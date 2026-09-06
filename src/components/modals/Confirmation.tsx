import { Box, Button, Group, Modal, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

type Props = {
  title: string;
  // A plain string, or a mix of text and inline elements (e.g. the
  // layout/layer name in bold — see `App`'s own "Replace" confirmation)
  // — `Text` renders either the same way.
  message: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Generic Yes/No confirmation dialog — a caller-supplied `title`/`message`
 * are the only thing that varies between uses (e.g. overwriting a cell/
 * division's content with a paste — see `Composer`). "No" and the modal's
 * own close (Escape, clicking outside) both just cancel. Same
 * padding/footer-border shape as every other modal (`LayoutEditor`,
 * `Divide`, `Settings`…). */
export default function Confirmation({
  title,
  message,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      opened
      onClose={onCancel}
      title={<Text fw={700}>{title}</Text>}
      centered
      size="sm"
      overlayProps={{ backgroundOpacity: 0.65, blur: 2 }}
      styles={{ body: { padding: 0 } }}
    >
      <Box style={{ padding: "24px 40px 40px" }}>
        <Stack>
          <Text>{message}</Text>
        </Stack>
      </Box>

      <Group
        justify="flex-end"
        p="md"
        style={{ borderTop: "1px solid var(--kbrd-border-color)" }}
      >
        <Button color="gray" onClick={onCancel}>
          No
        </Button>
        <Button color="red" onClick={onConfirm}>
          Yes
        </Button>
      </Group>
    </Modal>
  );
}
