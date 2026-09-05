import { useState } from "react";
import {
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";

import { createLayer, updateLayer } from "../../api/layers";
import type { LayerData } from "../../types/layer";

type Props = {
  layoutId: number;
  editing: LayerData | null;
  onClose: () => void;
  onSaved: (id: number) => void;
};

export default function LayerEditorModal({
  layoutId,
  editing,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [error, setError] = useState("");

  async function save() {
    try {
      const item = editing
        ? await updateLayer(editing.id, name, description)
        : await createLayer(layoutId, name, description);
      onSaved(item.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save layer.",
      );
    }
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={
        <Text fw={700}>
          {editing ? "Edit" : "Add"} layer
        </Text>
      }
      centered
      overlayProps={{ backgroundOpacity: 0.65, blur: 2 }}
      styles={{ body: { padding: 0 } }}
    >
      <Box style={{ padding: "24px 40px 40px" }}>
        <Stack>
          <TextInput
            variant="filled"
            label="Name"
            value={name}
            error={error || (!name.trim() ? "Name is required" : undefined)}
            success={!error && Boolean(name.trim())}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setError("");
            }}
          />
          <Textarea
            variant="filled"
            label="Description"
            value={description}
            success
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
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
          color="green"
          disabled={!name.trim()}
          onClick={() => void save()}
        >
          {editing ? "Save" : "Add"}
        </Button>
      </Group>
    </Modal>
  );
}
