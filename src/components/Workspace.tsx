import {
  Box,
  Group,
  Menu,
  Text,
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
  deactivateWorkspace,
  listWorkspaces,
} from "../api/workspaces";
import type { WorkspaceData } from "../types/workspace";
import WorkspaceEditorModal from "./WorkspaceEditorModal";

type Props = {
  geometryId: number;
  onChange: (workspace: WorkspaceData | null) => void;
};

export default function Workspace({ geometryId, onChange }: Props) {
  const [items, setItems] = useState<WorkspaceData[]>([]);
  const [selected, setSelected] = useState<WorkspaceData | null>(null);
  const [menuOpened, setMenuOpened] = useState(false);
  const [editorOpened, setEditorOpened] = useState(false);
  const [editing, setEditing] = useState<WorkspaceData | null>(null);

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
    setMenuOpened(false);
    setEditorOpened(true);
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

  return (
    <>
      <Menu
        opened={menuOpened}
        onChange={setMenuOpened}
        position="bottom-start"
        width={250}
        shadow="md"
        offset={0}
        styles={{
          dropdown: {
            borderRadius: "0 0 8px 8px",
            borderTop: "none",
          },
        }}
      >
        <Menu.Target>
          <UnstyledButton
            h={64}
            px="lg"
            onClick={() => setMenuOpened((value) => !value)}
            style={{
              width: 250,
              boxSizing: "border-box",
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
                    {selected?.name ?? "None"}
                  </Text>
                </Box>
              </Group>
              <MdChevronRight size={16} />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown ml={-1} w={251}>
          <Menu.Label>Workspaces</Menu.Label>
          {items.map((item) => (
            <Menu.Item
              key={item.id}
              onClick={() => void select(item)}
              leftSection={<MdDashboard size={18} />}
              rightSection={selected?.id === item.id && <MdCheck size={16} />}
              style={(theme) => ({
                backgroundColor:
                  selected?.id === item.id ? theme.white : undefined,
                color: selected?.id === item.id ? theme.black : undefined,
                borderRadius:
                  selected?.id === item.id ? theme.radius.xs : undefined,
              })}
            >
              <Text size="sm" fw={500}>
                {item.name}
              </Text>
              {item.description && (
                <Text
                  size="xs"
                  c={selected?.id === item.id ? "black" : "dimmed"}
                  lineClamp={1}
                >
                  {item.description}
                </Text>
              )}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item
            leftSection={<MdAdd size={18} />}
            onClick={() => openEditor(null)}
          >
            Add workspace
          </Menu.Item>
          {selected && (
            <Menu.Item
              leftSection={<MdEdit size={18} />}
              onClick={() => openEditor(selected)}
            >
              Edit workspace
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>
      {editorOpened && (
        <WorkspaceEditorModal
          geometryId={geometryId}
          editing={editing}
          onClose={() => setEditorOpened(false)}
          onSaved={(id) => {
            setEditorOpened(false);
            void refresh(id);
          }}
          onDeleted={() => {
            setEditorOpened(false);
            void refresh();
          }}
        />
      )}
    </>
  );
}
