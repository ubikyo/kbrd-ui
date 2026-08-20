import { AppShell, Box, Group, Text } from "@mantine/core";
import Geometry from "./pages/Geometry";

export default function App() {
  return (
    <AppShell
      header={{ height: 64 }}
      padding={0}
    >
      <AppShell.Header
        style={{
          backgroundColor: "var(--mantine-color-dark-7)",
          borderBottom: "1px solid var(--mantine-color-dark-6)",
        }}
      >
        <Group h="100%" gap={0}>
          <Box
            w={160}
            h="100%"
            px="lg"
            style={{
              display: "flex",
              alignItems: "center",
              borderRight: "1px solid var(--mantine-color-dark-6)",
            }}
          >
            <Text fw={700} size="xl">
              KBRD
            </Text>
          </Box>
        </Group>
      </AppShell.Header>

      <AppShell.Main
        style={{
          minHeight: "100vh",
          backgroundColor: "#151518",
        }}
      >
        <Geometry />
      </AppShell.Main>
    </AppShell>
  );
}