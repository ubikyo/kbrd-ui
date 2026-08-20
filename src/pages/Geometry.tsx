import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconPencil, IconTrash, IconPlus } from "@tabler/icons-react";

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

  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<GeometryData | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [unit, setUnit] = useState<"px" | "mm">("mm");
  const [geometry, setGeometry] = useState("[]");
  const [geometryError, setGeometryError] = useState("");

  const title = useMemo(
    () => (editing ? "Modifier une géométrie" : "Ajouter une géométrie"),
    [editing],
  );

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
    setOpened(true);
  }

  function openEdit(item: GeometryData) {
    setEditing(item);
    setName(item.name);
    setDescription(item.description);
    setAuthor(item.author);
    setUnit(item.unit);
    setGeometry(JSON.stringify(item.geometry, null, 2));
    setGeometryError("");
    setOpened(true);
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

    setOpened(false);
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

    await refresh();
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Géométries</Title>

        <Button
          leftSection={<IconPlus size={16} />}
          onClick={openAdd}
        >
          Ajouter
        </Button>
      </Group>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nom</Table.Th>
            <Table.Th>Auteur</Table.Th>
            <Table.Th style={{ width: 100 }}>Unité</Table.Th>
            <Table.Th style={{ width: 180 }}>Création</Table.Th>
            <Table.Th style={{ width: 120 }}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>

        <Table.Tbody>
          {items.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td>
                <Text fw={500}>{item.name}</Text>

                {item.description && (
                  <Text size="sm" c="dimmed" lineClamp={1}>
                    {item.description}
                  </Text>
                )}
              </Table.Td>

              <Table.Td>{item.author}</Table.Td>

              <Table.Td>{item.unit}</Table.Td>

              <Table.Td>{item.created_at}</Table.Td>

              <Table.Td>
                <Group gap="xs">
                  <ActionIcon
                    variant="subtle"
                    onClick={() => openEdit(item)}
                    aria-label="Modifier"
                  >
                    <IconPencil size={18} />
                  </ActionIcon>

                  <ActionIcon
                    color="red"
                    variant="subtle"
                    onClick={() => remove(item)}
                    aria-label="Supprimer"
                  >
                    <IconTrash size={18} />
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

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={title}
        centered
        size="xl"
      >
        <Stack>
          <TextInput
            label="Nom"
            placeholder="ISO"
            value={name}
            onChange={(e) =>
              setName(e.currentTarget.value)
            }
          />

          <Textarea
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
            label="Auteur"
            value={author}
            onChange={(e) =>
              setAuthor(e.currentTarget.value)
            }
          />

          <Select
            label="Unité"
            data={[
              { value: "mm", label: "Millimètres (mm)" },
              { value: "px", label: "Pixels (px)" },
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
            label="Géométrie"
            description="Définition JSON des rangées et des touches"
            value={geometry}
            onChange={(e) => {
              setGeometry(e.currentTarget.value);
              setGeometryError("");
            }}
            error={geometryError}
            autosize
            minRows={12}
            maxRows={25}
            styles={{
              input: {
                fontFamily: "monospace",
              },
            }}
          />

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setOpened(false)}
            >
              Annuler
            </Button>

            <Button
              onClick={save}
              disabled={!name.trim()}
            >
              Enregistrer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}