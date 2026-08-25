import {
  Box,
  Button,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  MdAdd,
  MdCheck,
  MdChevronRight,
  MdDashboard,
  MdEdit,
} from "react-icons/md";
import { useCallback, useEffect, useState } from "react";

import {
  activateWorkspace,
  createWorkspace,
  deactivateWorkspace,
  deleteWorkspace,
  listWorkspaces,
  updateWorkspace,
} from "../api/workspaces";
import type { WorkspaceData } from "../types/workspace";

type Props = {
  geometryId: number;
  onChange: (workspace: WorkspaceData | null) => void;
};

export default function Workspace({ geometryId, onChange }: Props) {
  const [items, setItems] = useState<WorkspaceData[]>([]);
  const [selected, setSelected] = useState<WorkspaceData | null>(null);
  const [menuOpened, setMenuOpened] = useState(false);
  const [editing, setEditing] = useState<WorkspaceData | null | undefined>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const select = useCallback(
    async (item: WorkspaceData) => {
      const value = await activateWorkspace(item.id);
      setSelected(value);
      onChange(value);
      setMenuOpened(false);
    },
    [onChange],
  );

  useEffect(() => {
    let cancelled = false;
    void listWorkspaces(geometryId).then(async (data) => {
      if (cancelled) return;
      setItems(data);
      const current = data.find((item) => item.active) ?? data[0];
      if (current) await select(current);
      else {
        await deactivateWorkspace();
        if (cancelled) return;
        setSelected(null);
        onChange(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [geometryId, onChange, select]);

  function openEditor(item: WorkspaceData | null) {
    setEditing(item);
    setName(item?.name ?? "");
    setDescription(item?.description ?? "");
    setMenuOpened(false);
  }

  async function refresh(preferredId?: number) {
    const data = await listWorkspaces(geometryId);
    setItems(data);
    const current = data.find((item) => item.id === preferredId) ?? data[0];
    if (current) await select(current);
    else {
      await deactivateWorkspace();
      setSelected(null);
      onChange(null);
    }
  }

  async function save() {
    const item = editing
      ? await updateWorkspace(editing.id, name, description)
      : await createWorkspace(geometryId, name, description);
    setEditing(undefined);
    await refresh(item.id);
  }

  async function remove() {
    if (!editing) return;
    await deleteWorkspace(editing.id);
    setEditing(undefined);
    await refresh();
  }

  return (
    <>
      <Menu
        opened={menuOpened}
        onChange={setMenuOpened}
        position="bottom-start"
        width={300}
        shadow="md"
        offset={4}
      >
        <Menu.Target>
          <UnstyledButton
            h={64}
            px="lg"
            onClick={() => setMenuOpened((value) => !value)}
            style={{
              width: 230,
              borderRight: "1px solid var(--kbrd-border-color)",
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <MdDashboard size={24} />
                <Box>
                  <Text size="xs" c="dimmed">
                    Workspace
                  </Text>
                  <Text size="sm" fw={500}>
                    {selected?.name ?? "Aucun"}
                  </Text>
                </Box>
              </Group>
              <MdChevronRight size={16} />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown p="xs" bg="var(--kbrd-color-surface)">
          <Menu.Label>WORKSPACES</Menu.Label>
          {items.map((item) => (
            <Menu.Item
              key={item.id}
              onClick={() => void select(item)}
              leftSection={<MdDashboard size={18} />}
              rightSection={selected?.id === item.id && <MdCheck size={16} />}
              style={(theme) => ({
                backgroundColor:
                  selected?.id === item.id ? theme.colors.violet[7] : undefined,
              })}
            >
              <Text size="sm" fw={500}>
                {item.name}
              </Text>
              {item.description && (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {item.description}
                </Text>
              )}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Label>Actions</Menu.Label>
          <Menu.Item
            leftSection={<MdAdd size={18} />}
            onClick={() => openEditor(null)}
          >
            Ajouter un workspace
          </Menu.Item>
          {selected && (
            <Menu.Item
              leftSection={<MdEdit size={18} />}
              onClick={() => openEditor(selected)}
            >
              Modifier le workspace
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
      <Modal
        opened={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? "Modifier le workspace" : "Ajouter un workspace"}
        overlayProps={{ backgroundOpacity: 0.65, blur: 2 }}
      >
        <Stack>
          <TextInput
            label="Nom"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <Textarea
            label="Description"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
          />
          <Group justify="space-between">
            {editing ? (
              <Button color="red" onClick={() => void remove()}>
                Supprimer
              </Button>
            ) : (
              <span />
            )}
            <Button disabled={!name.trim()} onClick={() => void save()}>
              Enregistrer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
