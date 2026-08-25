import { useState } from "react";
import {
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
  createWorkspace,
  deleteWorkspace,
  updateWorkspace,
} from "../api/workspaces";
import type { WorkspaceData } from "../types/workspace";

type Props = {
  geometryId: number;
  editing: WorkspaceData | null;
  onClose: () => void;
  onSaved: (id: number) => void;
  onDeleted: () => void;
};

export default function WorkspaceEditorModal({
  geometryId,
  editing,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    try {
      const item = editing
        ? await updateWorkspace(editing.id, name, description)
        : await createWorkspace(geometryId, name, description);
      onSaved(item.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Erreur lors de l'enregistrement.",
      );
    }
  }

  async function remove() {
    if (!editing) return;
    try {
      await deleteWorkspace(editing.id);
      onDeleted();
    } catch (cause) {
      setConfirmDelete(false);
      setError(cause instanceof Error ? cause.message : "Erreur de suppression.");
    }
  }

  return (
    <>
      <Modal
        opened
        onClose={onClose}
        title={
          <Text fw={700}>
            {editing ? "Modifier" : "Ajouter"} un workspace
          </Text>
        }
        centered
        overlayProps={{ backgroundOpacity: 0.65, blur: 2 }}
      >
        <Stack>
          <TextInput
            variant="filled"
            label="Nom"
            value={name}
            error={error || undefined}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setError("");
            }}
          />
          <Textarea
            variant="filled"
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
          <Group justify="space-between">
            {editing ? (
              <Button
                color="red"
                leftSection={<MdDelete size={16} />}
                onClick={() => setConfirmDelete(true)}
              >
                Supprimer
              </Button>
            ) : (
              <span />
            )}
            <Group>
              <Button color="gray" onClick={onClose}>
                Annuler
              </Button>
              <Button disabled={!name.trim()} onClick={() => void save()}>
                {editing ? "Enregistrer" : "Ajouter"}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={<Text fw={700}>Supprimer le workspace</Text>}
        centered
        size="sm"
      >
        <Stack>
          <Text>
            Supprimer le workspace{" "}
            <Text component="span" fw={600}>
              {editing?.name}
            </Text>{" "}
            ?
          </Text>
          <Text size="sm" c="dimmed">
            Cette action est irréversible.
          </Text>
          <Group justify="flex-end">
            <Button color="gray" onClick={() => setConfirmDelete(false)}>
              Annuler
            </Button>
            <Button
              color="red"
              leftSection={<MdDelete size={16} />}
              onClick={() => void remove()}
            >
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
