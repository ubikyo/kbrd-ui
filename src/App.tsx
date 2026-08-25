import {
  ActionIcon,
  AppShell,
  Box,
  Group,
  Splitter,
  Text,
  UnstyledButton,
} from "@mantine/core";

import { MdAdd, MdRemove } from "react-icons/md";

import { useCallback, useState } from "react";

import kbrdLogo from "./assets/media/KBRD.svg";

import Geometry from "./components/Geometry";
import type { GeometryData } from "./types/geometry";

import Preview from "./components/Preview";
import Inspector from "./components/Inspector";
import Workspace from "./components/Workspace";
import { addKeyPlugin } from "./api/workspaces";
import { pluginById } from "./plugins/registry";
import type { KeyPlugin, WorkspaceData } from "./types/workspace";

const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

export default function App() {
  const [geometry, setGeometry] = useState<GeometryData | null>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);

  const [zoom, setZoom] = useState(100);
  const [inspectorTab, setInspectorTab] = useState<string | null>("plugins");

  const changeGeometry = useCallback((value: GeometryData | null) => {
    setGeometry(value);
    setWorkspace(null);
    setSelectedKey(null);
    setZoom(100);
  }, []);

  const changeWorkspace = useCallback((value: WorkspaceData | null) => {
    setWorkspace(value);
    setSelectedKey(null);
  }, []);

  function changePlugins(plugins: KeyPlugin[]) {
    setWorkspace((value) => (value ? { ...value, plugins } : null));
  }

  async function dropPlugin(key: string, pluginId: string) {
    if (!workspace) return;
    const definition = pluginById(pluginId);
    if (!definition) return;
    const instance = await addKeyPlugin(
      workspace.id,
      key,
      definition.id,
      definition.version,
      structuredClone(definition.defaultConfig),
    );
    changePlugins([...workspace.plugins, instance]);
    setInspectorTab("properties");
  }

  function zoomOut() {
    setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP));
  }

  function zoomIn() {
    setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP));
  }

  return (
    <AppShell header={{ height: 64 }} padding={0}>
      <AppShell.Header
        bg="var(--kbrd-color-body)"
        style={{
          borderBottom: "1px solid var(--kbrd-border-color)",
        }}
      >
        <Group h="100%" gap={0}>
          <Box
            w={86}
            h="100%"
            px="xs"
            style={{
              display: "flex",
              alignItems: "center",
              boxSizing: "border-box",
            }}
          >
            <img
              src={kbrdLogo}
              alt="KBRD"
              style={{
                width: "100%",
                maxWidth: "100%",
                height: "auto",
                display: "block",
              }}
            />
          </Box>

          <Geometry onChange={changeGeometry} />
          {geometry && (
            <Workspace
              key={geometry.id}
              geometryId={geometry.id}
              onChange={changeWorkspace}
            />
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Main
        bg="var(--kbrd-color-body)"
        style={{
          height: "100vh",
        }}
      >
        <Splitter
          orientation="horizontal"
          lineSize={1}
          handleColor="var(--kbrd-border-color)"
          style={{
            position: "relative",
            height: "calc(100vh - 64px)",
            overflow: "hidden",
          }}
        >
          <Splitter.Pane defaultSize={75} min={40}>
            <Box h="100%" style={{ position: "relative", overflow: "hidden" }}>
              {geometry?.svg && (
                <Preview
                  svg={geometry.svg}
                  layout={geometry.layout}
                  workspace={workspace}
                  selectedKey={selectedKey}
                  onSelectKey={setSelectedKey}
                  onDropPlugin={(key, pluginId) =>
                    void dropPlugin(key, pluginId)
                  }
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
                  backgroundColor: "var(--mantine-color-dark-6)",
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
                  <Text size="xs">{zoom}%</Text>
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
          </Splitter.Pane>
          <Splitter.Pane defaultSize={25} min={20} max={50}>
            <Inspector
              workspace={workspace}
              selectedKey={selectedKey}
              tab={inspectorTab}
              onTabChange={setInspectorTab}
              onChange={changePlugins}
            />
          </Splitter.Pane>
        </Splitter>
      </AppShell.Main>
    </AppShell>
  );
}
