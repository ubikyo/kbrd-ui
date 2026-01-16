import { useState } from "react";
import { TextInput, Button, Stack, Text } from "@mantine/core";

export default function Hello() {
  const [name, setName] = useState("");
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function onSubmit() {
    setError("");
    setResult("");

    try {
      const r = await fetch("/api/hello", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const payload = await r.json().catch(() => ({}));

      if (!r.ok) {
        setError(payload?.error ?? `Erreur HTTP ${r.status}`);
        return;
      }

      setResult(payload.message ?? "");
    } catch (e: any) {
      setError(e?.message ?? "Erreur réseau");
    }
  }

  return (
    <Stack>
      <TextInput
        label="Prénom"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        placeholder="Ex: Jérôme"
      />
      <Button onClick={onSubmit}>Envoyer</Button>

      {result && <Text>{result}</Text>}
      {error && <Text c="red">{error}</Text>}
    </Stack>
  );
}