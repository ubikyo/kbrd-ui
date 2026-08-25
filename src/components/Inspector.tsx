import {
  Accordion,
  ActionIcon,
  Box,
  Group,
  Menu,
  Paper,
  Tabs,
  Text,
} from "@mantine/core";
import {
  MdArrowDownward,
  MdArrowUpward,
  MdDelete,
  MdLabel,
  MdMoreVert,
} from "react-icons/md";
import { useRef } from "react";

import { deleteKeyPlugin, updateKeyPlugin } from "../api/workspaces";
import { pluginById, plugins } from "../plugins/registry";
import type { KeyPlugin, WorkspaceData } from "../types/workspace";

type Props = {
  workspace: WorkspaceData | null;
  selectedKey: string | null;
  tab: string | null;
  onTabChange: (tab: string | null) => void;
  onChange: (plugins: KeyPlugin[]) => void;
};

export default function Inspector({
  workspace,
  selectedKey,
  tab,
  onTabChange,
  onChange,
}: Props) {
  const pendingSaves = useRef(
    new Map<
      number,
      { data: Partial<KeyPlugin>; timer: ReturnType<typeof setTimeout> }
    >(),
  );
  const allInstances = workspace?.plugins ?? [];
  const instances = allInstances
    .filter((plugin) => plugin.key_ref === selectedKey)
    .sort((left, right) => left.position - right.position);

  function patch(item: KeyPlugin, data: Partial<KeyPlugin>) {
    const value = { ...item, ...data };
    onChange(
      allInstances.map((plugin) => (plugin.id === value.id ? value : plugin)),
    );

    const pending = pendingSaves.current.get(item.id);
    if (pending) clearTimeout(pending.timer);
    const merged = { ...pending?.data, ...data };
    const timer = setTimeout(() => {
      pendingSaves.current.delete(item.id);
      void updateKeyPlugin(item.id, merged);
    }, 200);
    pendingSaves.current.set(item.id, { data: merged, timer });
  }

  async function move(index: number, direction: -1 | 1) {
    const item = instances[index];
    const neighbor = instances[index + direction];
    if (!item || !neighbor) return;
    const updatedItem = { ...item, position: neighbor.position };
    const updatedNeighbor = { ...neighbor, position: item.position };
    onChange(
      allInstances.map((plugin) =>
        plugin.id === updatedItem.id
          ? updatedItem
          : plugin.id === updatedNeighbor.id
            ? updatedNeighbor
            : plugin,
      ),
    );
    await Promise.all([
      updateKeyPlugin(item.id, { position: neighbor.position }),
      updateKeyPlugin(neighbor.id, { position: item.position }),
    ]);
  }

  async function remove(item: KeyPlugin) {
    const pending = pendingSaves.current.get(item.id);
    if (pending) clearTimeout(pending.timer);
    pendingSaves.current.delete(item.id);
    onChange(allInstances.filter((plugin) => plugin.id !== item.id));
    await deleteKeyPlugin(item.id);
  }

  return (
    <Box h="100%" bg="var(--kbrd-color-body)" p="lg" style={{ overflow: "auto" }}>
      <Tabs value={tab} onChange={onTabChange} variant="outline">
        <Tabs.List grow>
          <Tabs.Tab value="plugins">Plugins</Tabs.Tab>
          <Tabs.Tab value="properties">Properties</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="plugins" pt="lg" pb="lg">
          {!workspace ? (
            <Text c="dimmed">Créez un workspace pour ajouter des plugins.</Text>
          ) : (
            <Accordion multiple defaultValue={["Display"]}>
              {[...new Set(plugins.map((plugin) => plugin.category))].map(
                (category) => (
                  <Accordion.Item key={category} value={category}>
                    <Accordion.Control>{category}</Accordion.Control>
                    <Accordion.Panel>
                      {plugins
                        .filter((plugin) => plugin.category === category)
                        .map((plugin) => (
                          <Paper
                            key={plugin.id}
                            mb="xs"
                            draggable
                            style={{ cursor: "grab" }}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "copy";
                              event.dataTransfer.setData(
                                "application/kbrd-plugin",
                                plugin.id,
                              );
                            }}
                          >
                            <Group justify="space-between">
                              <Group gap="sm">
                                <MdLabel />
                                <Text>{plugin.name}</Text>
                              </Group>
                              <Text size="xs" c="dimmed">
                                {plugin.version}
                              </Text>
                            </Group>
                          </Paper>
                        ))}
                    </Accordion.Panel>
                  </Accordion.Item>
                ),
              )}
            </Accordion>
          )}
        </Tabs.Panel>
        <Tabs.Panel value="properties" p="md">
          {!selectedKey ? (
            <Text c="dimmed">Aucune touche sélectionnée</Text>
          ) : instances.length === 0 ? (
            <Text c="dimmed">Aucun plugin sur cette touche</Text>
          ) : (
            instances.map((item, index) => {
              const plugin = pluginById(item.plugin_id);
              if (!plugin) return null;
              const Editor = plugin.Editor;
              return (
                <Paper key={item.id} p="md" mb="sm" withBorder>
                  <Group justify="space-between" mb="sm">
                    <Text fw={600}>{plugin.name}</Text>
                    <Menu position="bottom-end">
                      <Menu.Target>
                        <ActionIcon
                          variant="subtle"
                          aria-label="Actions du plugin"
                        >
                          <MdMoreVert />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<MdArrowUpward />}
                          disabled={index === 0}
                          onClick={() => void move(index, -1)}
                        >
                          Up
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<MdArrowDownward />}
                          disabled={index === instances.length - 1}
                          onClick={() => void move(index, 1)}
                        >
                          Down
                        </Menu.Item>
                        <Menu.Item
                          onClick={() =>
                            void patch(item, { enabled: !item.enabled })
                          }
                        >
                          {item.enabled ? "Disabled" : "Enabled"}
                        </Menu.Item>
                        <Menu.Item
                          color="red"
                          leftSection={<MdDelete />}
                          onClick={() => void remove(item)}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                  <Editor
                    disabled={!item.enabled}
                    config={item.config}
                    onChange={(config) => void patch(item, { config })}
                  />
                </Paper>
              );
            })
          )}
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
