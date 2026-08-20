import { useEffect, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Modal,
  Popover,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconCheck,
  IconChevronRight,
  IconGeometry,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";

type GeometryItem = {
  name: string;
  rowspan: number;
  colspan: number;
  size: number;
  quantity: number;
};

type GeometryData = {
  id: number;
  name: string;
  description: string;
  author: string;
  unit: "px" | "mm";
  geometry: GeometryItem[][];
  created_at: string;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export default function Geometry() {
  const [items, setItems] = useState<GeometryData[]>([]);
  const [selected, setSelected] = useState<GeometryData | null>(null);

  const [menuOpened, setMenuOpened] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);

  const [editing, setEditing] = useState<GeometryData | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [unit, setUnit] = useState<"px" | "mm">("mm");
  const [geometry, setGeometry] = useState("[]");
  const [geometryError, setGeometryError] = useState("");

  async function refresh(selectId?: number) {
    const data = await api<GeometryData[]>("/api/geometry");

    setItems(data);

    if (selectId !== undefined) {
      setSelected(data.find((item) => item.id === selectId) ?? null);
      return;
    }

    if (!selected && data.length > 0) {
      setSelected(data[0]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function openAdd() {
    setEditing(null);

    setName("");
    setDescription("");
    setAuthor("");
    setUnit("mm");
    setGeometry("[]");
    setGeometryError("");

    setMenuOpened(false);
    setModalOpened(true);
  }

  function openEdit(item: GeometryData) {
    setEditing(item);

    setName(item.name);
    setDescription(item.description ?? "");
    setAuthor(item.author ?? "");
    setUnit(item.unit);
    setGeometry(JSON.stringify(item.geometry, null, 2));
    setGeometryError("");

    setMenuOpened(false);
    setModalOpened(true);
  }

  async function save() {
    let parsedGeometry: GeometryItem[][];

    try {
      parsedGeometry = JSON.parse(geometry);

      if (!Array.isArray(parsedGeometry)) {
        setGeometryError("La géométrie doit être un tableau JSON.");
        return;
      }
    } catch {
      setGeometryError("Le JSON de la géométrie n'est pas valide.");
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      author: author.trim(),
      unit,
      geometry: parsedGeometry,
    };

    if (!payload.name) {
      return;
    }

    if (editing) {
      await api<GeometryData>(`/api/geometry/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setModalOpened(false);
      await refresh(editing.id);
    } else {
      const created = await api<GeometryData>("/api/geometry", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setModalOpened(false);
      await refresh(created.id);
    }
  }

  async function remove(item: GeometryData) {
    if (!window.confirm(`Supprimer "${item.name}" ?`)) {
      return;
    }

    await api(`/api/geometry/${item.id}`, {
      method: "DELETE",
    });

    setModalOpened(false);

    const data = await api<GeometryData[]>("/api/geometry");

    setItems(data);
    setSelected(data[0] ?? null);
  }

  return (
    <>
      {/* Barre supérieure Geometry */}
      <Box
        pos="fixed"
        top={0}
        left={160}
        style={{ zIndex: 200 }}
      >
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
              onClick={() => setMenuOpened((value) => !value)}
              style={{
                width: 230,
                backgroundColor: "var(--mantine-color-dark-6)",
                borderRight:
                  "1px solid var(--mantine-color-dark-5)",
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <IconGeometry size={24} stroke={1.5} />

                  <Box>
                    <Text size="xs" c="dimmed">
                      Geometry
                    </Text>

                    <Text size="sm" fw={500}>
                      {selected?.name ?? "Default"}
                    </Text>
                  </Box>
                </Group>

                <IconChevronRight size={16} />
              </Group>
            </UnstyledButton>
          </Popover.Target>

          <Popover.Dropdown p="xs">
            <Group justify="space-between" px="xs" mb="xs">
              <Text size="xs" c="dimmed" fw={600}>
                GEOMETRIES
              </Text>

              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={openAdd}
              >
                <IconPlus size={16} />
              </ActionIcon>
            </Group>

            <Stack gap={4}>
              {items.map((item) => (
                <UnstyledButton
                  key={item.id}
                  onClick={() => {
                    setSelected(item);
                    setMenuOpened(false);
                  }}
                  p="sm"
                  style={(theme) => ({
                    borderRadius: theme.radius.sm,
                    backgroundColor:
                      selected?.id === item.id
                        ? theme.colors.violet[7]
                        : undefined,
                  })}
                >
                  <Group justify="space-between">
                    <Group gap="sm">
                      <IconGeometry size={18} />

                      <Box>
                        <Text size="sm" fw={500}>
                          {item.name}
                        </Text>

                        {item.description && (
                          <Text size="xs" c="dimmed">
                            {item.description}
                          </Text>
                        )}
                      </Box>
                    </Group>

                    {selected?.id === item.id && (
                      <IconCheck size={16} />
                    )}
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>

            <Box
              mt="xs"
              pt="xs"
              style={{
                borderTop:
                  "1px solid var(--mantine-color-dark-4)",
              }}
            >
              <UnstyledButton
                w="100%"
                p="sm"
                onClick={openAdd}
              >
                <Group gap="sm">
                  <IconPlus size={18} />
                  <Text size="sm">Ajouter une géométrie</Text>
                </Group>
              </UnstyledButton>

              {selected && (
                <UnstyledButton
                  w="100%"
                  p="sm"
                  onClick={() => openEdit(selected)}
                >
                  <Group gap="sm">
                    <IconPencil size={18} />
                    <Text size="sm">
                      Modifier la géométrie
                    </Text>
                  </Group>
                </UnstyledButton>
              )}
            </Box>
          </Popover.Dropdown>
        </Popover>
      </Box>

      {/* Modal ajout / modification */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={
          editing
            ? "Modifier la géométrie"
            : "Ajouter une géométrie"
        }
        centered
        size="lg"
        overlayProps={{
          backgroundOpacity: 0.65,
          blur: 2,
        }}
      >
        <Stack>
          <Group grow>
            <TextInput
              variant="filled"
              label="Nom"
              placeholder="ISO"
              value={name}
              onChange={(e) =>
                setName(e.currentTarget.value)
              }
              required
            />

            <TextInput
              variant="filled"
              label="Auteur"
              value={author}
              onChange={(e) =>
                setAuthor(e.currentTarget.value)
              }
            />
          </Group>

          <Select
            variant="filled"
            label="Unité"
            data={[
              {
                value: "mm",
                label: "Millimètres (mm)",
              },
              {
                value: "px",
                label: "Pixels (px)",
              },
            ]}
            value={unit}
            allowDeselect={false}
            onChange={(value) => {
              if (value === "mm" || value === "px") {
                setUnit(value);
              }
            }}
          />

          <Textarea
            variant="filled"
            label="Description"
            value={description}
            onChange={(e) =>
              setDescription(e.currentTarget.value)
            }
            autosize
            minRows={2}
            maxRows={4}
          />

          <Textarea
            variant="filled"
            label="Géométrie"
            description="Définition JSON des rangées et des touches"
            value={geometry}
            onChange={(e) => {
              setGeometry(e.currentTarget.value);
              setGeometryError("");
            }}
            error={geometryError}
            autosize
            minRows={10}
            maxRows={20}
            styles={{
              input: {
                fontFamily: "monospace",
              },
            }}
          />

          <Group justify="space-between" mt="md">
            <Box>
              {editing && (
                <Button
                  variant="filled"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => remove(editing)}
                >
                  Supprimer
                </Button>
              )}
            </Box>

            <Group>
              <Button
                variant="filled"
                color="gray"
                onClick={() => setModalOpened(false)}
              >
                Annuler
              </Button>

              <Button
                variant="filled"
                onClick={save}
                disabled={!name.trim()}
              >
                {editing ? "Enregistrer" : "Ajouter"}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}