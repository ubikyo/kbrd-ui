import {
  AppShell,
  Box,
  Group,
  Text,
} from "@mantine/core";
import { useState } from "react";

import Geometry, {
  type GeometryData,
} from "./components/Geometry";
import KeyboardPreview from "./components/KeyboardPreview";
import InspectorPanel from "./components/InspectorPanel";

export default function App() {
  const [geometry, setGeometry] =
    useState<GeometryData | null>(null);

  const [selectedKey, setSelectedKey] =
    useState<string | null>(null);

  function changeGeometry(
    value: GeometryData | null,
  ) {
    setGeometry(value);
    setSelectedKey(null);
  }

  return (
    <AppShell
      header={{ height: 64 }}
      padding={0}
    >
      <AppShell.Header
        style={{
          backgroundColor:
            "var(--mantine-color-dark-7)",
          borderBottom:
            "1px solid var(--mantine-color-dark-6)",
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
              borderRight:
                "1px solid var(--mantine-color-dark-6)",
            }}
          >
            <Text fw={700} size="xl">
              KBRD
            </Text>
          </Box>

          <Geometry onChange={changeGeometry} />
        </Group>
      </AppShell.Header>

      <AppShell.Main
        style={{
          height: "100vh",
          backgroundColor: "#101113",
        }}
      >
        <Group
          gap={0}
          wrap="nowrap"
          align="stretch"
          style={{
            height: "calc(100vh - 64px)",
          }}
        >
          <Box
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {geometry?.svg && (
              <KeyboardPreview
                svg={geometry.svg}
                selectedKey={selectedKey}
                onSelectKey={setSelectedKey}
              />
            )}
          </Box>

          <InspectorPanel
            selectedKey={selectedKey}
          />
        </Group>
      </AppShell.Main>
    </AppShell>
  );
}