import { Container, Group, Anchor, Title } from "@mantine/core";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import ApiDemo from "./pages/ApiDemo";

export default function App() {
  return (
    <Container size="md" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={3}>kbrd-ui</Title>
        <Group gap="md">
          <Anchor component={Link} to="/">
            Accueil
          </Anchor>
          <Anchor component={Link} to="/api">
            Démo API
          </Anchor>
        </Group>
      </Group>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/api" element={<ApiDemo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Container>
  );
}
