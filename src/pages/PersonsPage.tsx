import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Group,
  Modal,
  Stack,
  Table,
  TextInput,
  Title,
  ActionIcon,
  Text,
} from "@mantine/core";
import { IconPencil, IconTrash, IconPlus } from "@tabler/icons-react";

type Person = {
  id: number;
  first_name: string;
  last_name: string;
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

export default function PersonsPage() {
  const [items, setItems] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);

  const [opened, setOpened] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const title = useMemo(() => (editing ? "Modifier une personne" : "Ajouter une personne"), [editing]);

  async function refresh() {
    setLoading(true);
    try {
      const data = await api<Person[]>("/api/person");
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
    setFirstName("");
    setLastName("");
    setOpened(true);
  }

  function openEdit(p: Person) {
    setEditing(p);
    setFirstName(p.first_name);
    setLastName(p.last_name);
    setOpened(true);
  }

  async function save() {
    const payload = { first_name: firstName.trim(), last_name: lastName.trim() };
    if (!payload.first_name || !payload.last_name) return;

    if (editing) {
      await api<Person>(`/api/person/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api<Person>("/api/person", { method: "POST", body: JSON.stringify(payload) });
    }
    setOpened(false);
    await refresh();
  }

  async function remove(p: Person) {
    const ok = window.confirm(`Supprimer ${p.first_name} ${p.last_name} ?`);
    if (!ok) return;
    await api<{ ok: boolean }>(`/api/person/${p.id}`, { method: "DELETE" });
    await refresh();
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Personnes</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={openAdd}>
          Ajouter
        </Button>
      </Group>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Prénom</Table.Th>
            <Table.Th>Nom</Table.Th>
            <Table.Th style={{ width: 120 }}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((p) => (
            <Table.Tr key={p.id}>
              <Table.Td>{p.first_name}</Table.Td>
              <Table.Td>{p.last_name}</Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon variant="subtle" onClick={() => openEdit(p)} aria-label="Modifier">
                    <IconPencil size={18} />
                  </ActionIcon>
                  <ActionIcon color="red" variant="subtle" onClick={() => remove(p)} aria-label="Supprimer">
                    <IconTrash size={18} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {items.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={3}>
                <Text c="dimmed">{loading ? "Chargement..." : "Aucune personne"}</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={() => setOpened(false)} title={title} centered>
        <Stack>
          <TextInput label="Prénom" value={firstName} onChange={(e) => setFirstName(e.currentTarget.value)} />
          <TextInput label="Nom" value={lastName} onChange={(e) => setLastName(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpened(false)}>Annuler</Button>
            <Button onClick={save} disabled={!firstName.trim() || !lastName.trim()}>
              Enregistrer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
