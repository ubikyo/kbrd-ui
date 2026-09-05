import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Box, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { MdAdd, MdCheck, MdChevronRight, MdKeyboardAlt } from "react-icons/md";

import { listLayouts } from "../api/layouts";
import type { LayoutData } from "../types/layout";
import { defaultLayout } from "../utils/layout";

type Props = {
  onChange: (layout: LayoutData | null) => void;
  // Edit/Delete/Resize live in Display's own display Actions menu (select
  // the physical screen), but Add stays reachable straight from this
  // picker too — the "+" below the list, the quickest path to a new one.
  onAdd: () => void;
};

// Add/Edit/Delete now live in Display's own display Actions menu (select the
// physical screen), not here — this dropdown is just the picker. `App`
// drives those through this handle so it can refresh the list and
// re-select afterwards, the same way this component always has.
export type LayoutMenuHandle = {
  refresh: (preferredId?: number) => Promise<void>;
};

const Layout = forwardRef<LayoutMenuHandle, Props>(function Layout(
  { onChange, onAdd },
  ref,
) {
  const [items, setItems] = useState<LayoutData[]>([]);
  const [selected, setSelected] = useState<LayoutData | null>(null);
  const [menuOpened, setMenuOpened] = useState(false);

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

  useImperativeHandle(ref, () => ({ refresh }));

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

  return (
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
              // Always set, not just when selected — otherwise the hover
              // background (Mantine's own default) falls back to the
              // dropdown's own square corners instead of matching this.
              borderRadius: theme.radius.xs,
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
        <UnstyledButton
          aria-label="Add layout"
          className="picker-add-button"
          onClick={() => {
            setMenuOpened(false);
            onAdd();
          }}
          style={{
            width: "100%",
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MdAdd size={24} />
        </UnstyledButton>
      </Menu.Dropdown>
    </Menu>
  );
});

export default Layout;
