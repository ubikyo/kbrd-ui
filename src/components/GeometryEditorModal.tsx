import { useState } from "react";
import {
  Box,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { MdDelete } from "react-icons/md";

import {
  createGeometry,
  deleteGeometry,
  updateGeometry,
} from "../api/geometries";
import type {
  GeometryData,
  GeometryGroup,
  GeometryPayload,
} from "../types/geometry";

type Props = {
  editing: GeometryData | null;
  onClose: () => void;
  onSaved: (id: number) => void;
  onDeleted: () => void;
};

export default function GeometryEditorModal({
  editing,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [author, setAuthor] = useState(editing?.author ?? "");
  const [unit, setUnit] = useState<"px" | "mm">(editing?.unit ?? "mm");
  const [geometry, setGeometry] = useState(
    JSON.stringify(editing?.geometry ?? [], null, 2),
  );
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    let parsedGeometry: GeometryGroup[];
    try {
      parsedGeometry = JSON.parse(geometry) as GeometryGroup[];
      if (!Array.isArray(parsedGeometry)) {
        throw new Error("Geometry must be a JSON array.");
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The geometry JSON is invalid.",
      );
      return;
    }

    const payload: GeometryPayload = {
      name: name.trim(),
      description: description.trim(),
      author: author.trim(),
      unit,
      geometry: parsedGeometry,
    };
    if (!payload.name) return;

    try {
      const saved = editing
        ? await updateGeometry(editing.id, payload)
        : await createGeometry(payload);
      onSaved(saved.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to save geometry.",
      );
    }
  }

  async function remove() {
    if (!editing) return;
    try {
      await deleteGeometry(editing.id);
      onDeleted();
    } catch (cause) {
      setConfirmDelete(false);
      setError(cause instanceof Error ? cause.message : "Unable to delete geometry.");
    }
  }

  return (
    <>
      <Modal
        opened
        onClose={onClose}
        title={<Text fw={700}>{editing ? "Edit" : "Add"} geometry</Text>}
        centered
        size="lg"
        overlayProps={{ backgroundOpacity: 0.65, blur: 2 }}
        styles={{
          content: {
            display: "flex",
            flexDirection: "column",
            height: "85vh",
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
                onChange={(event) => setName(event.currentTarget.value)}
                required
              />
              <TextInput
                variant="filled"
                label="Author"
                value={author}
                onChange={(event) => setAuthor(event.currentTarget.value)}
              />
            </Group>
            <Select
              variant="filled"
              label="Unit"
              data={[
                { value: "mm", label: "Millimetres (mm)" },
                { value: "px", label: "Pixels (px)" },
              ]}
              value={unit}
              allowDeselect={false}
              onChange={(value) => {
                if (value === "mm" || value === "px") setUnit(value);
              }}
            />
            <Textarea
              variant="filled"
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={4}
            />
            <Textarea
              variant="filled"
              label="Geometry"
              description="JSON definition of groups, rows and keys"
              value={geometry}
              onChange={(event) => {
                setGeometry(event.currentTarget.value);
                setError("");
              }}
              error={error}
              minRows={30}
              resize="vertical"
              styles={{ input: { fontFamily: "monospace", minHeight: 520 } }}
            />
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
        title={<Text fw={700}>Delete geometry</Text>}
        centered
        size="sm"
      >
        <Stack>
          <Text>Delete geometry <Text component="span" fw={600}>{editing?.name}</Text>?</Text>
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
