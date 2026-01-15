import { Card, Text, Title } from "@mantine/core";

export default function Home() {
  return (
    <Card withBorder radius="md" p="lg">
      <Title order={2} mb="sm">
        Hello world 👋
      </Title>
      <Text>
        Base React + Vite + Router + Mantine. La page “Démo API” fait un appel
        HTTP externe.
      </Text>
    </Card>
  );
}
