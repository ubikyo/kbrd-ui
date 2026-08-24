import { useEffect, useState } from "react";
import {
  Box,
  Group,
  Popover,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
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
      data.find((item) => item.id === preferredId)
      ?? data.find((item) => item.id === selected?.id)
      ?? defaultGeometry(data)
      ?? null,
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
      <Popover
        opened={menuOpened}
        onChange={setMenuOpened}
        position="bottom-start"
        width={300}
        shadow="md"
        offset={4}
      >
        <Popover.Target>
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
                  <Text size="xs" c="dimmed">Geometry</Text>
                  <Text size="sm" fw={500}>{selected?.name ?? "Aucune"}</Text>
                </Box>
              </Group>
              <MdChevronRight size={16} />
            </Group>
          </UnstyledButton>
        </Popover.Target>

        <Popover.Dropdown p="xs" bg="var(--kbrd-color-surface)">
          <Text size="xs" c="dimmed" fw={600} px="xs" mb="xs">
            GEOMETRIES
          </Text>
          <Stack gap={4}>
            {items.map((item) => (
              <UnstyledButton
                key={item.id}
                onClick={() => {
                  select(item);
                  setMenuOpened(false);
                }}
                p="sm"
                style={(theme) => ({
                  borderRadius: theme.radius.sm,
                  backgroundColor:
                    selected?.id === item.id ? theme.colors.violet[7] : undefined,
                })}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="sm" wrap="nowrap">
                    <MdKeyboardAlt size={18} />
                    <Box style={{ minWidth: 0 }}>
                      <Text size="sm" fw={500}>{item.name}</Text>
                      {item.description && (
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {item.description}
                        </Text>
                      )}
                    </Box>
                  </Group>
                  {selected?.id === item.id && <MdCheck size={16} />}
                </Group>
              </UnstyledButton>
            ))}
          </Stack>

          <Box mt="xs" pt="xs">
            <UnstyledButton w="100%" p="sm" onClick={() => openEditor(null)}>
              <Group gap="sm">
                <MdAdd size={18} />
                <Text size="sm">Ajouter une géométrie</Text>
              </Group>
            </UnstyledButton>
            {selected && (
              <UnstyledButton w="100%" p="sm" onClick={() => openEditor(selected)}>
                <Group gap="sm">
                  <MdEdit size={18} />
                  <Text size="sm">Modifier la géométrie</Text>
                </Group>
              </UnstyledButton>
            )}
          </Box>
        </Popover.Dropdown>
      </Popover>

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
