import {
  useEffect,
  useState,
} from "react";

import {
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
  MdAdd,
  MdCheck,
  MdChevronRight,
  MdDelete,
  MdEdit,
  MdKeyboardAlt,
} from "react-icons/md";

export type GeometryElement = {
  type: "key" | "space";
  name: string;
  ref?: string;
  rowspan: number;
  colspan: number;
  size: number;
  quantity: number;
  gap?: number;
  parts?: GeometryPart[];
};

export type GeometryPart = {
  width?: number;
  height?: number;
  align?: "left" | "center" | "right";
};

export type GeometryGroup = {
  name: string;
  gap: number;
  elements: GeometryElement[];
};

export type GeometryData = {
  id: number;
  name: string;
  description: string;
  author: string;
  unit: "px" | "mm";
  geometry: GeometryGroup[];
  svg: string;
  created_at: string;
};

type GeometryProps = {
  onChange: (
    geometry: GeometryData | null,
  ) => void;
};

async function api<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });

  if (!res.ok) {
    const msg = await res
      .text()
      .catch(() => "");

    throw new Error(
      msg || `HTTP ${res.status}`,
    );
  }

  return (await res.json()) as T;
}

export default function Geometry({
  onChange,
}: GeometryProps) {
  const [items, setItems] =
    useState<GeometryData[]>([]);

  const [selected, setSelected] =
    useState<GeometryData | null>(null);

  const [menuOpened, setMenuOpened] =
    useState(false);

  const [modalOpened, setModalOpened] =
    useState(false);

  const [
    deleteModalOpened,
    setDeleteModalOpened,
  ] = useState(false);

  const [editing, setEditing] =
    useState<GeometryData | null>(null);

  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [author, setAuthor] =
    useState("");

  const [unit, setUnit] =
    useState<"px" | "mm">("mm");

  const [geometry, setGeometry] =
    useState("[]");

  const [
    geometryError,
    setGeometryError,
  ] = useState("");

  function selectGeometry(
    item: GeometryData,
  ) {
    setSelected(item);
    onChange(item);
  }

  async function refresh(
    selectId?: number,
  ) {
    const data =
      await api<GeometryData[]>(
        "/api/geometry",
      );

    setItems(data);

    let current:
      | GeometryData
      | undefined;

    if (selectId !== undefined) {
      current = data.find(
        (item) =>
          item.id === selectId,
      );
    }

    if (!current && selected) {
      current = data.find(
        (item) =>
          item.id === selected.id,
      );
    }

    if (!current) {
      current =
        data.find(
          (item) =>
            item.name.toLowerCase() ===
            "default",
        ) ?? data[0];
    }

    if (current) {
      selectGeometry(current);
    } else {
      setSelected(null);
      onChange(null);
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

  function openEdit(
    item: GeometryData,
  ) {
    setEditing(item);

    setName(item.name);
    setDescription(
      item.description ?? "",
    );
    setAuthor(
      item.author ?? "",
    );
    setUnit(item.unit);

    setGeometry(
      JSON.stringify(
        item.geometry,
        null,
        2,
      ),
    );

    setGeometryError("");

    setMenuOpened(false);
    setModalOpened(true);
  }

  async function save() {
    let parsedGeometry:
      GeometryGroup[][];

    try {
      parsedGeometry =
        JSON.parse(geometry);

      if (!Array.isArray(parsedGeometry)) {
        setGeometryError(
          "La géométrie doit être un tableau JSON.",
        );
        return;
      }

      setGeometryError("");
    } catch {
      setGeometryError(
        "Le JSON de la géométrie n'est pas valide.",
      );
      return;
    }

    const payload = {
      name: name.trim(),
      description:
        description.trim(),
      author: author.trim(),
      unit,
      geometry: parsedGeometry,
    };

    if (!payload.name) {
      return;
    }

    try {
      if (editing) {
        await api<GeometryData>(
          `/api/geometry/${editing.id}`,
          {
            method: "PUT",
            body: JSON.stringify(
              payload,
            ),
          },
        );

        setModalOpened(false);

        await refresh(
          editing.id,
        );
      } else {
        const created =
          await api<GeometryData>(
            "/api/geometry",
            {
              method: "POST",
              body: JSON.stringify(
                payload,
              ),
            },
          );

        setModalOpened(false);

        await refresh(
          created.id,
        );
      }
    } catch (error) {
      setGeometryError(
        error instanceof Error
          ? error.message
          : "Erreur lors de l'enregistrement.",
      );
    }
  }

  function askDelete() {
    if (!editing) {
      return;
    }

    setDeleteModalOpened(true);
  }

  async function confirmDelete() {
    if (!editing) {
      return;
    }

    await api<{ ok: boolean }>(
      `/api/geometry/${editing.id}`,
      {
        method: "DELETE",
      },
    );

    setDeleteModalOpened(false);
    setModalOpened(false);

    const data =
      await api<GeometryData[]>(
        "/api/geometry",
      );

    setItems(data);

    const next =
      data.find(
        (item) =>
          item.name.toLowerCase() ===
          "default",
      ) ?? data[0];

    if (next) {
      selectGeometry(next);
    } else {
      setSelected(null);
      onChange(null);
    }
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
            onClick={() =>
              setMenuOpened(
                (value) => !value,
              )
            }
            style={{
              width: 230,
              borderLeft: "1px solid var(--kbrd-border-color)",
              borderRight: "1px solid var(--kbrd-border-color)",
            }}
          >
            <Group
              justify="space-between"
              wrap="nowrap"
            >
              <Group
                gap="sm"
                wrap="nowrap"
              >
                <MdKeyboardAlt
                  size={24}
                />

                <Box>
                  <Text
                    size="xs"
                    c="dimmed"
                  >
                    Geometry
                  </Text>

                  <Text
                    size="sm"
                    fw={500}
                  >
                    {selected?.name ??
                      "Aucune"}
                  </Text>
                </Box>
              </Group>

              <MdChevronRight
                size={16}
              />
            </Group>
          </UnstyledButton>
        </Popover.Target>

        <Popover.Dropdown
          p="xs"
          bg="var(--kbrd-color-surface)"
        >
          <Text
            size="xs"
            c="dimmed"
            fw={600}
            px="xs"
            mb="xs"
          >
            GEOMETRIES
          </Text>

          <Stack gap={4}>
            {items.map(
              (item) => (
                <UnstyledButton
                  key={item.id}
                  onClick={() => {
                    selectGeometry(
                      item,
                    );

                    setMenuOpened(
                      false,
                    );
                  }}
                  p="sm"
                  style={(theme) => ({
                    borderRadius:
                      theme.radius.sm,

                    backgroundColor:
                      selected?.id ===
                      item.id
                        ? theme
                            .colors
                            .violet[7]
                        : undefined,
                  })}
                >
                  <Group
                    justify="space-between"
                    wrap="nowrap"
                  >
                    <Group
                      gap="sm"
                      wrap="nowrap"
                    >
                      <MdKeyboardAlt
                        size={18}
                      />

                      <Box
                        style={{
                          minWidth: 0,
                        }}
                      >
                        <Text
                          size="sm"
                          fw={500}
                        >
                          {item.name}
                        </Text>

                        {item.description && (
                          <Text
                            size="xs"
                            c="dimmed"
                            lineClamp={1}
                          >
                            {item.description}
                          </Text>
                        )}
                      </Box>
                    </Group>

                    {selected?.id ===
                      item.id && (
                      <MdCheck
                        size={16}
                      />
                    )}
                  </Group>
                </UnstyledButton>
              ),
            )}
          </Stack>

          <Box
            mt="xs"
            pt="xs"
          >
            <UnstyledButton
              w="100%"
              p="sm"
              onClick={openAdd}
            >
              <Group gap="sm">
                <MdAdd
                  size={18}
                />

                <Text size="sm">
                  Ajouter une géométrie
                </Text>
              </Group>
            </UnstyledButton>

            {selected && (
              <UnstyledButton
                w="100%"
                p="sm"
                onClick={() =>
                  openEdit(
                    selected,
                  )
                }
              >
                <Group gap="sm">
                  <MdEdit
                    size={18}
                  />

                  <Text size="sm">
                    Modifier la géométrie
                  </Text>
                </Group>
              </UnstyledButton>
            )}
          </Box>
        </Popover.Dropdown>
      </Popover>

      {/* Ajout / modification */}
      <Modal
        opened={modalOpened}
        onClose={() =>
          setModalOpened(false)
        }
        title={
          <Text fw={700}>
            {editing
              ? "Modifier la géométrie"
              : "Ajouter une géométrie"}
          </Text>
        }
        centered
        size="lg"
        overlayProps={{
          backgroundOpacity: 0.65,
          blur: 2,
        }}
        styles={{
          content: {
            display: "flex",
            flexDirection: "column",
            height: "85vh",
            maxHeight: "85vh",
            backgroundColor:
              "var(--kbrd-color-surface)",
          },

          header: {
            backgroundColor:
              "var(--kbrd-color-surface)",
          },

          body: {
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            padding: 0,
          },
        }}
      >
        <Box
          p="md"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
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
                  setName(
                    e.currentTarget.value,
                  )
                }
                required
              />

              <TextInput
                variant="filled"
                label="Auteur"
                value={author}
                onChange={(e) =>
                  setAuthor(
                    e.currentTarget.value,
                  )
                }
              />
            </Group>

            <Select
              variant="filled"
              label="Unité"
              data={[
                {
                  value: "mm",
                  label:
                    "Millimètres (mm)",
                },
                {
                  value: "px",
                  label:
                    "Pixels (px)",
                },
              ]}
              value={unit}
              allowDeselect={false}
              onChange={(value) => {
                if (
                  value === "mm" ||
                  value === "px"
                ) {
                  setUnit(value);
                }
              }}
            />

            <Textarea
              variant="filled"
              label="Description"
              value={description}
              onChange={(e) =>
                setDescription(
                  e.currentTarget.value,
                )
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
                setGeometry(
                  e.currentTarget.value,
                );
                setGeometryError("");
              }}
              error={geometryError}
              minRows={30}
              resize="vertical"
              styles={{
                input: {
                  fontFamily:
                    "monospace",
                  minHeight: 520,
                },
              }}
            />
          </Stack>
        </Box>

        {/* Footer fixe */}
        <Group
          justify="space-between"
          p="md"
          style={{
            flexShrink: 0,
            borderTop:
              "1px solid var(--mantine-color-dark-4)",
            backgroundColor:
              "var(--kbrd-color-surface)",
          }}
        >
          <Box>
            {editing && (
              <Button
                variant="filled"
                color="red"
                leftSection={
                  <MdDelete
                    size={16}
                  />
                }
                onClick={askDelete}
              >
                Supprimer
              </Button>
            )}
          </Box>

          <Group>
            <Button
              variant="filled"
              color="gray"
              onClick={() =>
                setModalOpened(false)
              }
            >
              Annuler
            </Button>

            <Button
              variant="filled"
              onClick={save}
              disabled={!name.trim()}
            >
              {editing
                ? "Enregistrer"
                : "Ajouter"}
            </Button>
          </Group>
        </Group>
      </Modal>

      {/* Confirmation suppression */}
      <Modal
        opened={deleteModalOpened}
        onClose={() =>
          setDeleteModalOpened(false)
        }
        title={
          <Text fw={700}>
            Supprimer la géométrie
          </Text>
        }
        centered
        size="sm"
        overlayProps={{
          backgroundOpacity: 0.65,
          blur: 2,
        }}
        styles={{
          content: {
            backgroundColor:
              "var(--kbrd-color-surface)",
          },
          header: {
            backgroundColor:
              "var(--kbrd-color-surface)",
          },
        }}
      >
        <Stack>
          <Text>
            Supprimer la géométrie{" "}
            <Text
              component="span"
              fw={600}
            >
              {editing?.name}
            </Text>
            {" "}?
          </Text>

          <Text
            size="sm"
            c="dimmed"
          >
            Cette action est irréversible.
          </Text>

          <Group
            justify="flex-end"
            mt="sm"
          >
            <Button
              variant="filled"
              color="gray"
              onClick={() =>
                setDeleteModalOpened(false)
              }
            >
              Annuler
            </Button>

            <Button
              variant="filled"
              color="red"
              leftSection={
                <MdDelete size={16} />
              }
              onClick={confirmDelete}
            >
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
