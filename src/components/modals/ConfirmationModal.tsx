import { Button, Group, Modal, Stack, Text } from "@mantine/core";

type Props = {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Generic Yes/No confirmation dialog — a caller-supplied `title`/`message`
 * are the only thing that varies between uses (e.g. overwriting a cell/
 * division's content with a paste — see `Composer`). "No" and the modal's
 * own close (Escape, clicking outside) both just cancel. */
export default function ConfirmationModal({
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
    >
      <Stack>
        <Text>{message}</Text>
        <Group justify="flex-end">
          <Button color="gray" onClick={onCancel}>
            No
          </Button>
          <Button color="red" onClick={onConfirm}>
            Yes
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
