import { Container, Group, Anchor, Title } from "@mantine/core";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Geometry from "./pages/Geometry";

export default function App() {
  return (
    <Container size="md" py="xl">
      <Group justify="space-between" mb="lg">
        <Title order={3}>Manager</Title>
        <Group gap="md">
          <Anchor component={Link} to="/">
            Accueil
          </Anchor>
          <Anchor component={Link} to="/geometry">
            Geometries
          </Anchor>
        </Group>
      </Group>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/geometry" element={<Geometry />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Container>
  );
}
