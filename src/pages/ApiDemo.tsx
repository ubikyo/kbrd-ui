import { useEffect, useState } from "react";
import { Card, Code, Loader, Text, Title, Alert } from "@mantine/core";

type ApiState =
  | { status: "loading" }
  | { status: "ok"; data: unknown }
  | { status: "error"; message: string };

export default function ApiDemo() {
  const [state, setState] = useState<ApiState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const resp = await fetch("https://httpbin.org/get", {
          method: "GET",
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }

        const json = await resp.json();
        if (!cancelled) setState({ status: "ok", data: json });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur inconnue";
        if (!cancelled) setState({ status: "error", message: msg });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card withBorder radius="md" p="lg">
      <Title order={2} mb="sm">
        Démo API externe
      </Title>
      <Text mb="md">
        Requête GET vers <Code>https://httpbin.org/get</Code>
      </Text>

      {state.status === "loading" && <Loader />}

      {state.status === "error" && (
        <Alert title="Erreur" color="red">
          {state.message}
        </Alert>
      )}

      {state.status === "ok" && (
        <Code block>{JSON.stringify(state.data, null, 2)}</Code>
      )}
    </Card>
  );
}
