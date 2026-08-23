import {
  ActionIcon,
  AppShell,
  Box,
  Group,
  Text,
  UnstyledButton,
} from "@mantine/core";

import {
  MdAdd,
  MdRemove,
} from "react-icons/md";

import { useState } from "react";

import kbrdLogo from "./assets/media/KBRD.svg";

import Geometry, {
  type GeometryData,
} from "./components/Geometry";

import Preview from "./components/Preview";
import Properties from "./components/Properties";

const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

export default function App() {
  const [geometry, setGeometry] =
    useState<GeometryData | null>(null);

  const [selectedKey, setSelectedKey] =
    useState<string | null>(null);

  const [zoom, setZoom] = useState(100);

  function changeGeometry(
    value: GeometryData | null,
  ) {
    setGeometry(value);
    setSelectedKey(null);
    setZoom(100);
  }

  function zoomOut() {
    setZoom((value) =>
      Math.max(MIN_ZOOM, value - ZOOM_STEP),
    );
  }

  function zoomIn() {
    setZoom((value) =>
      Math.min(MAX_ZOOM, value + ZOOM_STEP),
    );
  }

  return (
    <AppShell 
      header={{ height: 64 }}
      padding={0}
    >
      <AppShell.Header
        bg="var(--kbrd-color-body)"
        style={{
          borderBottom: "1px solid var(--kbrd-border-color)",
        }}
      >
        <Group h="100%" gap={0}>
          <Box
            w={100}
            h="100%"
            px="xs"
            style={{
              display: "flex",
              alignItems: "center"
            }}
          >
            <img
              src={kbrdLogo}
              alt="KBRD"
              style={{
                width: "100px",
                height: "auto",
                display: "block",
              }}
            />
          </Box>

          <Geometry onChange={changeGeometry} />
        </Group>
      </AppShell.Header>

      <AppShell.Main
        bg="var(--kbrd-color-body)"
        style={{
          height: "100vh",
        }}
      >
        <Box
          style={{
            position: "relative",
            display: "flex",
            height: "calc(100vh - 64px)",
            overflow: "hidden",
          }}
        >
          {/* Zone centrale */}
          <Box
            style={{
              position: "relative",
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            {geometry?.svg && (
              <Preview
                svg={geometry.svg}
                selectedKey={selectedKey}
                onSelectKey={setSelectedKey}
                zoom={zoom}
              />
            )}

            {/* Zoom */}
            <Group
              gap={4}
              style={{
                position: "absolute",
                left: 20,
                bottom: 20,
                zIndex: 20,
                padding: 4,
                borderRadius: 4,
                backgroundColor:
                  "var(--mantine-color-dark-6)",
              }}
            >
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={zoomOut}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Dézoomer"
              >
                <MdRemove size={15} />
              </ActionIcon>

              <UnstyledButton
                onClick={() => setZoom(100)}
                style={{
                  minWidth: 44,
                  textAlign: "center",
                }}
                title="Revenir à 100 %"
              >
                <Text size="xs">
                  {zoom}%
                </Text>
              </UnstyledButton>

              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={zoomIn}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Zoomer"
              >
                <MdAdd size={15} />
              </ActionIcon>
            </Group>
          </Box>

          <Properties
            selectedKey={selectedKey}
          />
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
