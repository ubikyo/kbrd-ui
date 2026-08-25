import { useEffect, useState } from "react";
import { Box, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import {
  MdAdd,
  MdCheck,
  MdChevronRight,
  MdEdit,
  MdKeyboardAlt,
} from "react-icons/md";

import { listGeometries } from "../api/geometries";
import type { GeometryData } from "../types/geometry";
import { defaultGeometry } from "../utils/geometry";
import GeometryEditorModal from "./GeometryEditorModal";

type Props = {
  onChange: (geometry: GeometryData | null) => void;
};

export default function Geometry({ onChange }: Props) {
  const [items, setItems] = useState<GeometryData[]>([]);
  const [selected, setSelected] = useState<GeometryData | null>(null);
  const [menuOpened, setMenuOpened] = useState(false);
  const [editorOpened, setEditorOpened] = useState(false);
  const [editing, setEditing] = useState<GeometryData | null>(null);

  function select(item: GeometryData | null) {
    setSelected(item);
    onChange(item);
  }

  async function refresh(preferredId?: number) {
    const data = await listGeometries();
    setItems(data);
    select(
      data.find((item) => item.id === preferredId) ??
        data.find((item) => item.id === selected?.id) ??
        defaultGeometry(data) ??
        null,
    );
  }

  useEffect(() => {
    let cancelled = false;
    listGeometries().then((data) => {
      if (cancelled) return;
      const current = defaultGeometry(data) ?? null;
      setItems(data);
      setSelected(current);
      onChange(current);
    });
    return () => {
      cancelled = true;
    };
  }, [onChange]);

  function openEditor(item: GeometryData | null) {
    setEditing(item);
    setMenuOpened(false);
    setEditorOpened(true);
  }

  return (
    <>
      <Menu
        opened={menuOpened}
        onChange={setMenuOpened}
        position="bottom-start"
        width={300}
        shadow="md"
        offset={0}
        styles={{
          dropdown: {
            borderRadius: "0 0 8px 8px",
            border: "1px solid var(--kbrd-border-color)",
            backgroundColor: "var(--kbrd-color-body)",
            borderTop: "none",
          },
        }}
      >
        <Menu.Target>
          <UnstyledButton
            h={64}
            px="lg"
            onClick={() => setMenuOpened((opened) => !opened)}
            style={{
              width: 230,
              borderLeft: "1px solid var(--kbrd-border-color)",
              borderRight: "1px solid var(--kbrd-border-color)",
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <MdKeyboardAlt size={24} />
                <Box>
                  <Text size="xs" c="dimmed">
                    Geometry
                  </Text>
                  <Text size="sm" fw={500}>
                    {selected?.name ?? "Aucune"}
                  </Text>
                </Box>
              </Group>
              <MdChevronRight size={16} />
            </Group>
          </UnstyledButton>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Geometries</Menu.Label>
          {items.map((item) => (
            <Menu.Item
              key={item.id}
              onClick={() => {
                select(item);
                setMenuOpened(false);
              }}
              leftSection={<MdKeyboardAlt size={18} />}
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
            Ajouter une géométrie
          </Menu.Item>
          {selected && (
            <Menu.Item
              leftSection={<MdEdit size={18} />}
              onClick={() => openEditor(selected)}
            >
              Modifier la géométrie
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>

      {editorOpened && (
        <GeometryEditorModal
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
