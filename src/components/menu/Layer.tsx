import {
  Box,
  Group,
  Menu,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { MdAdd, MdCheck, MdChevronRight, MdDashboard } from "react-icons/md";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import {
  activateLayer,
  deactivateLayer,
  listLayers,
} from "../../api/layers";
import type { LayerData } from "../../types/layer";

type Props = {
  layoutId: number;
  onChange: (layer: LayerData | null) => void;
  // Edit/Delete live in Display's own display Actions menu (select the
  // physical screen), but Add stays reachable straight from this picker
  // too — the "+" below the list, the quickest path to a new one.
  onAdd: () => void;
  // The full list, whenever it (re)loads — lets `App` build the "Replace
  // with current" picker (every *other* layer) without this component
  // needing to know anything about that feature itself.
  onItemsChange?: (items: LayerData[]) => void;
  // Layer only matters in Mapping mode (Render/Invoke plugins attach to
  // it; Layout plugins attach to the Layout itself) — `App` hides this
  // picker in Layout mode by setting this, rather than unmounting the
  // component outright, so switching modes back and forth doesn't
  // re-trigger its own load/(re)activate effect above every time.
  hidden?: boolean;
};

// Add/Edit/Delete now live in Display's own display Actions menu (select the
// physical screen), not here — this dropdown is just the picker. `App`
// drives those through this handle so it can refresh the list and
// re-select afterwards, the same way this component always has.
export type LayerMenuHandle = {
  refresh: (preferredId?: number) => Promise<void>;
};

const Layer = forwardRef<LayerMenuHandle, Props>(function Layer(
  { layoutId, onChange, onAdd, onItemsChange, hidden = false },
  ref,
) {
  const [items, setItems] = useState<LayerData[]>([]);
  const [selected, setSelected] = useState<LayerData | null>(null);
  const [menuOpened, setMenuOpened] = useState(false);

  const select = useCallback(
    async (item: LayerData) => {
      const value = await activateLayer(item.id);
      setSelected(value);
      onChange(value);
      setMenuOpened(false);
    },
    [onChange],
  );

  useEffect(() => {
    let cancelled = false;
    void listLayers(layoutId).then(async (data) => {
      if (cancelled) return;
      setItems(data);
      onItemsChange?.(data);
      const current = data.find((item) => item.active) ?? data[0];
      if (current) await select(current);
      else {
        await deactivateLayer();
        if (cancelled) return;
        setSelected(null);
        onChange(null);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutId, onChange, select]);

  async function refresh(preferredId?: number) {
    const data = await listLayers(layoutId);
    setItems(data);
    onItemsChange?.(data);
    const current = data.find((item) => item.id === preferredId) ?? data[0];
    if (current) await select(current);
    else {
      await deactivateLayer();
      setSelected(null);
      onChange(null);
    }
  }

  useImperativeHandle(ref, () => ({ refresh }));

  if (hidden) return null;

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
                  Layer
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
          aria-label="Add layer"
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

export default Layer;
