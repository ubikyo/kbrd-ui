import { useEffect, useState } from "react";
import {
  ActionIcon,
  Button,
  Drawer,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconDeviceFloppy,
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
  const [loading, setLoading] = useState(false);

  const [drawerOpened, setDrawerOpened] = useState(false);
  const [editing, setEditing] = useState<GeometryData | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [unit, setUnit] = useState<"px" | "mm">("mm");
  const [geometry, setGeometry] = useState("[]");
  const [geometryError, setGeometryError] = useState("");

  async function refresh() {
    setLoading(true);

    try {
      const data = await api<GeometryData[]>("/api/geometry");
      setItems(data);
    } finally {
      setLoading(false);
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
    setDrawerOpened(true);
  }

  function openEdit(item: GeometryData) {
    setEditing(item);
    setName(item.name);
    setDescription(item.description ?? "");
    setAuthor(item.author ?? "");
    setUnit(item.unit);
    setGeometry(JSON.stringify(item.geometry, null, 2));
    setGeometryError("");
    setDrawerOpened(true);
  }

  function closeDrawer() {
    setDrawerOpened(false);
    setGeometryError("");
  }

  async function save() {
    let parsedGeometry: GeometryItem[][];

    try {
      parsedGeometry = JSON.parse(geometry);

      if (!Array.isArray(parsedGeometry)) {
        setGeometryError("La géométrie doit être un tableau JSON.");
        return;
      }

      setGeometryError("");
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
    } else {
      await api<GeometryData>("/api/geometry", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    closeDrawer();
    await refresh();
  }

  async function remove(item: GeometryData) {
    const ok = window.confirm(
      `Supprimer la géométrie "${item.name}" ?`,
    );

    if (!ok) {
      return;
    }

    await api<{ ok: boolean }>(`/api/geometry/${item.id}`, {
      method: "DELETE",
    });

    if (editing?.id === item.id) {
      closeDrawer();
    }

    await refresh();
  }

  return (
    <>
      <Stack>
        <Group justify="space-between">
          <div>
            <Title order={2}>Géométries</Title>

            <Text size="sm" c="dimmed">
              Gestion des géométries de clavier
            </Text>
          </div>

          <Button
            variant="filled"
            leftSection={<IconPlus size={16} />}
            onClick={openAdd}
          >
            Ajouter
          </Button>
        </Group>

        <Paper withBorder>
          <Table
            striped
            highlightOnHover
            verticalSpacing="sm"
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nom</Table.Th>
                <Table.Th>Auteur</Table.Th>
                <Table.Th style={{ width: 100 }}>
                  Unité
                </Table.Th>
                <Table.Th style={{ width: 180 }}>
                  Création
                </Table.Th>
                <Table.Th style={{ width: 100 }}>
                  Actions
                </Table.Th>
              </Table.Tr>
            </Table.Thead>

            <Table.Tbody>
              {items.map((item) => (
                <Table.Tr
                  key={item.id}
                  onClick={() => openEdit(item)}
                  style={{ cursor: "pointer" }}
                >
                  <Table.Td>
                    <Text fw={500}>{item.name}</Text>

                    {item.description && (
                      <Text
                        size="sm"
                        c="dimmed"
                        lineClamp={1}
                      >
                        {item.description}
                      </Text>
                    )}
                  </Table.Td>

                  <Table.Td>
                    {item.author}
                  </Table.Td>

                  <Table.Td>
                    {item.unit}
                  </Table.Td>

                  <Table.Td>
                    {item.created_at}
                  </Table.Td>

                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="filled"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(item);
                        }}
                        aria-label="Modifier"
                      >
                        <IconPencil size={16} />
                      </ActionIcon>

                      <ActionIcon
                        variant="filled"
                        color="red"
                        onClick={(event) => {
                          event.stopPropagation();
                          remove(item);
                        }}
                        aria-label="Supprimer"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}

              {items.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed">
                      {loading
                        ? "Chargement..."
                        : "Aucune géométrie"}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      </Stack>

      <Drawer
        opened={drawerOpened}
        onClose={closeDrawer}
        position="right"
        size="lg"
        title={
          <Text fw={600} size="lg">
            {editing
              ? "Modifier la géométrie"
              : "Nouvelle géométrie"}
          </Text>
        }
        overlayProps={{
          backgroundOpacity: 0.35,
          blur: 6,
        }}
        transitionProps={{
          transition: "slide-left",
          duration: 250,
        }}
      >
        <Stack gap="md">
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

          <Textarea
            variant="filled"
            label="Description"
            value={description}
            onChange={(e) =>
              setDescription(e.currentTarget.value)
            }
            autosize
            minRows={3}
            maxRows={6}
          />

          <TextInput
            variant="filled"
            label="Auteur"
            value={author}
            onChange={(e) =>
              setAuthor(e.currentTarget.value)
            }
          />

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
            label="Géométrie"
            description="Définition JSON des rangées et des touches"
            value={geometry}
            onChange={(e) => {
              setGeometry(e.currentTarget.value);
              setGeometryError("");
            }}
            error={geometryError}
            autosize
            minRows={15}
            maxRows={30}
            styles={{
              input: {
                fontFamily: "monospace",
              },
            }}
          />

          <Group justify="space-between" mt="md">
            {editing ? (
              <Button
                variant="filled"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={() => remove(editing)}
              >
                Supprimer
              </Button>
            ) : (
              <div />
            )}

            <Group>
              <Button
                variant="filled"
                color="gray"
                onClick={closeDrawer}
              >
                Annuler
              </Button>

              <Button
                variant="filled"
                leftSection={
                  <IconDeviceFloppy size={16} />
                }
                onClick={save}
                disabled={!name.trim()}
              >
                Enregistrer
              </Button>
            </Group>
          </Group>
        </Stack>
      </Drawer>
    </>
  );
}