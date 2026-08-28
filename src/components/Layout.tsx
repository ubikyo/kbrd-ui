import { useEffect, useState } from "react";
import { Box, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import {
  MdAdd,
  MdCheck,
  MdChevronRight,
  MdEdit,
  MdKeyboardAlt,
} from "react-icons/md";

import { listLayouts } from "../api/layouts";
import type { LayoutData } from "../types/layout";
import { defaultLayout } from "../utils/layout";
import LayoutEditorModal from "./LayoutEditorModal";

type Props = {
  onChange: (layout: LayoutData | null) => void;
};

export default function Layout({ onChange }: Props) {
  const [items, setItems] = useState<LayoutData[]>([]);
  const [selected, setSelected] = useState<LayoutData | null>(null);
  const [menuOpened, setMenuOpened] = useState(false);
  const [editorOpened, setEditorOpened] = useState(false);
  const [editing, setEditing] = useState<LayoutData | null>(null);

  function select(item: LayoutData | null) {
    setSelected(item);
    onChange(item);
  }

  async function refresh(preferredId?: number) {
    const data = await listLayouts();
    setItems(data);
    select(
      data.find((item) => item.id === preferredId) ??
        data.find((item) => item.id === selected?.id) ??
        defaultLayout(data) ??
        null,
    );
  }

  useEffect(() => {
    let cancelled = false;
    listLayouts().then((data) => {
      if (cancelled) return;
      const current = defaultLayout(data) ?? null;
      setItems(data);
      setSelected(current);
      onChange(current);
    });
    return () => {
      cancelled = true;
    };
  }, [onChange]);

  function openEditor(item: LayoutData | null) {
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
            onClick={() => setMenuOpened((opened) => !opened)}
            style={{
              width: 250,
              boxSizing: "border-box",
              borderLeft: "1px solid var(--kbrd-border-color)",
              borderRight: "1px solid var(--kbrd-border-color)",
            }}
          >
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <MdKeyboardAlt size={24} />
                <Box>
                  <Text size="xs" c="dimmed">
                    Layout
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

        <Menu.Dropdown>
          <Menu.Label>Layouts</Menu.Label>
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
            Add layout
          </Menu.Item>
          {selected && (
            <Menu.Item
              leftSection={<MdEdit size={18} />}
              onClick={() => openEditor(selected)}
            >
              Edit layout
            </Menu.Item>
          )}
        </Menu.Dropdown>
      </Menu>

      {editorOpened && (
        <LayoutEditorModal
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
