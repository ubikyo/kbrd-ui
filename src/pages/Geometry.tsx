import { useEffect, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Divider,
  Group,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import {
  IconDeviceFloppy,
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

  const [editing, setEditing] = useState<GeometryData | null>(null);
  const [isNew, setIsNew] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [unit, setUnit] = useState<"px" | "mm">("mm");
  const [geometry, setGeometry] = useState("[]");
  const [geometryError, setGeometryError] = useState("");

  async function refresh(selectId?: number) {
    setLoading(true);

    try {
      const data = await api<GeometryData[]>("/api/geometry");
      setItems(data);

      if (selectId !== undefined) {
        const selected = data.find((item) => item.id === selectId);

        if (selected) {
          selectItem(selected);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function fillForm(item: GeometryData) {
    setName(item.name);
    setDescription(item.description ?? "");
    setAuthor(item.author ?? "");
    setUnit(item.unit);
    setGeometry(JSON.stringify(item.geometry, null, 2));
    setGeometryError("");
  }

  function selectItem(item: GeometryData) {
    setEditing(item);
    setIsNew(false);
    fillForm(item);
  }

  function newItem() {
    setEditing(null);
    setIsNew(true);

    setName("");
    setDescription("");
    setAuthor("");
    setUnit("mm");
    setGeometry("[]");
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
      const updated = await api<GeometryData>(
        `/api/geometry/${editing.id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );

      await refresh(updated.id);
    } else {
      const created = await api<GeometryData>("/api/geometry", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setIsNew(false);
      await refresh(created.id);
    }
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
      setEditing(null);
      setIsNew(false);
    }

    await refresh();
  }

  return (
    <Stack h="calc(100vh - 48px)" gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Géométries</Title>
          <Text size="sm" c="dimmed">
            Gestion des géométries de clavier
          </Text>
        </div>

        <Button
          leftSection={<IconPlus size={16} />}
          onClick={newItem}
        >
          Nouvelle géométrie
        </Button>
      </Group>

      <Group
        align="stretch"
        gap="md"
        wrap="nowrap"
        style={{ flex: 1, minHeight: 0 }}
      >
        {/* Liste */}
        <Paper
          withBorder
          w={320}
          style={{
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <Stack gap={0} h="100%">
            <Box p="md">
              <Text fw={600}>Géométries</Text>
              <Text size="xs" c="dimmed">
                {items.length} élément{items.length > 1 ? "s" : ""}
              </Text>
            </Box>

            <Divider />

            <ScrollArea style={{ flex: 1 }}>
              {items.map((item) => {
                const selected = editing?.id === item.id;

                return (
                  <Box
                    key={item.id}
                    px="md"
                    py="sm"
                    onClick={() => selectItem(item)}
                    style={(theme) => ({
                      cursor: "pointer",
                      borderBottom: `1px solid ${theme.colors.dark[4]}`,
                      backgroundColor: selected
                        ? theme.colors.dark[5]
                        : undefined,
                    })}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Box style={{ minWidth: 0 }}>
                        <Text fw={selected ? 600 : 500} truncate>
                          {item.name}
                        </Text>

                        <Text size="xs" c="dimmed" truncate>
                          {item.description || "Sans description"}
                        </Text>
                      </Box>

                      <Text size="xs" c="dimmed">
                        {item.unit}
                      </Text>
                    </Group>
                  </Box>
                );
              })}

              {items.length === 0 && (
                <Text p="md" size="sm" c="dimmed">
                  {loading
                    ? "Chargement..."
                    : "Aucune géométrie"}
                </Text>
              )}
            </ScrollArea>
          </Stack>
        </Paper>

        {/* Formulaire */}
        <Paper
          withBorder
          p="lg"
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "auto",
          }}
        >
          {!editing && !isNew ? (
            <Stack
              align="center"
              justify="center"
              h="100%"
              gap="xs"
            >
              <Text fw={500}>Aucune géométrie sélectionnée</Text>

              <Text size="sm" c="dimmed">
                Sélectionne une géométrie ou crée-en une nouvelle.
              </Text>
            </Stack>
          ) : (
            <Stack>
              <Group justify="space-between">
                <div>
                  <Title order={3}>
                    {editing
                      ? editing.name
                      : "Nouvelle géométrie"}
                  </Title>

                  {editing && (
                    <Text size="xs" c="dimmed">
                      ID {editing.id}
                    </Text>
                  )}
                </div>

                {editing && (
                  <ActionIcon
                    color="red"
                    variant="subtle"
                    size="lg"
                    onClick={() => remove(editing)}
                    aria-label="Supprimer"
                  >
                    <IconTrash size={20} />
                  </ActionIcon>
                )}
              </Group>

              <Divider />

              <Group grow align="flex-start">
                <TextInput
                  label="Nom"
                  placeholder="ISO"
                  value={name}
                  onChange={(e) =>
                    setName(e.currentTarget.value)
                  }
                  required
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
              </Group>

              <Textarea
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
                label="Géométrie"
                description="Définition JSON des rangées et des touches"
                value={geometry}
                onChange={(e) => {
                  setGeometry(e.currentTarget.value);
                  setGeometryError("");
                }}
                error={geometryError}
                autosize
                minRows={14}
                maxRows={30}
                styles={{
                  input: {
                    fontFamily: "monospace",
                  },
                }}
              />

              <Group justify="flex-end">
                <Button
                  leftSection={<IconDeviceFloppy size={16} />}
                  onClick={save}
                  disabled={!name.trim()}
                >
                  Enregistrer
                </Button>
              </Group>
            </Stack>
          )}
        </Paper>
      </Group>
    </Stack>
  );
}