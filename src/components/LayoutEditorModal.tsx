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
import { MdDelete } from "react-icons/md";

import {
  createLayout,
  deleteLayout,
  updateLayout,
} from "../api/layouts";
import type { LayoutData, LayoutPayload } from "../types/layout";

type Props = {
  editing: LayoutData | null;
  onClose: () => void;
  onSaved: (id: number) => void;
  onDeleted: () => void;
};

export default function LayoutEditorModal({
  editing,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [author, setAuthor] = useState(editing?.author ?? "");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    const payload: LayoutPayload = {
      name: name.trim(),
      description: description.trim(),
      author: author.trim(),
      // Positioning now lives in Layout mode, not this form — keep
      // whatever was already stored, or start empty for a brand-new layout.
      unit: editing?.unit ?? "mm",
      geometry: editing?.geometry ?? [],
    };
    if (!payload.name) return;

    try {
      const saved = editing
        ? await updateLayout(editing.id, payload)
        : await createLayout(payload);
      onSaved(saved.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save layout.",
      );
    }
  }

  async function remove() {
    if (!editing) return;
    try {
      await deleteLayout(editing.id);
      onDeleted();
    } catch (cause) {
      setConfirmDelete(false);
      setError(cause instanceof Error ? cause.message : "Unable to delete layout.");
    }
  }

  return (
    <>
      <Modal
        opened
        onClose={onClose}
        title={<Text fw={700}>{editing ? "Edit" : "Add"} layout</Text>}
        centered
        size="lg"
        overlayProps={{ backgroundOpacity: 0.65, blur: 2 }}
        styles={{
          content: {
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--kbrd-color-body)",
          },
          header: { backgroundColor: "var(--kbrd-color-body)" },
          body: { display: "flex", flexDirection: "column", flex: 1, minHeight: 0 },
        }}
      >
        <Box p="md" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <Stack>
            <Group grow>
              <TextInput
                variant="filled"
                label="Name"
                placeholder="ISO"
                value={name}
                error={!name.trim() ? "Name is required" : undefined}
                success={Boolean(name.trim())}
                onChange={(event) => setName(event.currentTarget.value)}
                required
              />
              <TextInput
                variant="filled"
                label="Author"
                value={author}
                success
                onChange={(event) => setAuthor(event.currentTarget.value)}
              />
            </Group>
            <Textarea
              variant="filled"
              label="Description"
              value={description}
              success
              onChange={(event) => setDescription(event.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={4}
            />
            {error && (
              <Text size="sm" c="red">
                {error}
              </Text>
            )}
          </Stack>
        </Box>
        <Group
          justify="space-between"
          p="md"
          style={{
            flexShrink: 0,
            borderTop: "1px solid var(--mantine-color-dark-4)",
          }}
        >
          <Box>
            {editing && (
              <Button
                color="red"
                leftSection={<MdDelete size={16} />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            )}
          </Box>
          <Group>
            <Button color="gray" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={!name.trim()}>
              {editing ? "Save" : "Add"}
            </Button>
          </Group>
        </Group>
      </Modal>

      <Modal
        opened={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={<Text fw={700}>Delete layout</Text>}
        centered
        size="sm"
      >
        <Stack>
          <Text>Delete layout <Text component="span" fw={600}>{editing?.name}</Text>?</Text>
          <Text size="sm" c="dimmed">This action cannot be undone.</Text>
          <Group justify="flex-end">
            <Button color="gray" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button color="red" leftSection={<MdDelete size={16} />} onClick={remove}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
