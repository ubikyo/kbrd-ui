import {
  ActionIcon,
  AppShell,
  Box,
  Button,
  Group,
  Notification,
  Splitter,
  Text,
  UnstyledButton,
} from "@mantine/core";

import {
  MdAdd,
  MdContentCopy,
  MdDriveFileMove,
  MdRemove,
  MdSettings,
} from "react-icons/md";

import { useCallback, useRef, useState } from "react";

import kbrdLogo from "./assets/media/KBRD.svg";

import Geometry from "./components/Geometry";
import type { GeometryData } from "./types/geometry";

import Preview from "./components/Preview";
import Inspector from "./components/Inspector";
import SettingsModal from "./components/SettingsModal";
import Workspace from "./components/Workspace";
import {
  addKeyPlugin,
  clearKey,
  duplicateKeyPlugins,
  moveKey,
} from "./api/workspaces";
import { pluginById } from "./plugins/registry";
import type {
  KeyPlugin,
  KeyProperty,
  WorkspaceData,
} from "./types/workspace";

const MIN_ZOOM = 25;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;
const BACKGROUND_REF = "__background__";

export default function App() {
  const [geometry, setGeometry] = useState<GeometryData | null>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);

  const [settingsOpened, setSettingsOpened] = useState(false);

  const [zoom, setZoom] = useState(100);
  const [inspectorTab, setInspectorTab] = useState<string | null>("plugins");
  const [previewDownPluginId, setPreviewDownPluginId] = useState<number | null>(
    null,
  );
  const [previewDownTarget, setPreviewDownTarget] = useState<string | null>(
    null,
  );
  const [keyOperation, setKeyOperation] = useState<{
    direction: "from" | "to" | "move";
    key: string;
  } | null>(null);
  const keyOperationRef = useRef<{
    direction: "from" | "to" | "move";
    key: string;
  } | null>(null);

  function stopKeyOperation() {
    keyOperationRef.current = null;
    setKeyOperation(null);
  }

  const changeGeometry = useCallback((value: GeometryData | null) => {
    setGeometry(value);
    setWorkspace(null);
    setSelectedKey(null);
    keyOperationRef.current = null;
    setKeyOperation(null);
    setPreviewDownPluginId(null);
    setPreviewDownTarget(null);
    setZoom(100);
  }, []);

  const changeWorkspace = useCallback((value: WorkspaceData | null) => {
    setWorkspace(value);
    setSelectedKey(null);
    keyOperationRef.current = null;
    setKeyOperation(null);
    setPreviewDownPluginId(null);
    setPreviewDownTarget(null);
  }, []);

  function changePlugins(plugins: KeyPlugin[]) {
    setWorkspace((value) => (value ? { ...value, plugins } : null));
  }

  function changeKeyProperties(keyProperties: KeyProperty[]) {
    setWorkspace((value) =>
      value ? { ...value, key_properties: keyProperties } : null,
    );
  }

  async function dropPlugin(key: string, pluginId: string) {
    if (!workspace) return;
    const definition = pluginById(pluginId);
    if (!definition) return;
    const target = geometry?.layout.keys.find((item) => item.ref === key);
    if (definition.capabilities.includes("action") && target?.type !== "key") {
      return;
    }
    const config: Record<string, unknown> = structuredClone(
      definition.defaultConfig,
    );
    if (key === BACKGROUND_REF) delete config.down;
    const instance = await addKeyPlugin(
      workspace.id,
      key,
      definition.id,
      definition.version,
      config,
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

  function selectKey(key: string | null) {
    const operation = keyOperationRef.current;
    const clickedKey = geometry?.layout.keys.find(
      (item) => item.ref === key && item.type === "key",
    );
    if (operation && clickedKey && workspace) {
      const source = operation.direction === "from" ? clickedKey.ref : operation.key;
      const destination =
        operation.direction === "from" ? operation.key : clickedKey.ref;
      if (source === destination) return;
      if (operation.direction === "move") {
        keyOperationRef.current = null;
        void moveKey(workspace.id, source, destination).then(
          (value) => {
            setWorkspace(value);
            setSelectedKey(destination);
            setKeyOperation(null);
            setPreviewDownPluginId(null);
            setPreviewDownTarget(null);
          },
          () => setKeyOperation(null),
        );
        return;
      }
      if (operation.direction === "from") keyOperationRef.current = null;
      void duplicateKeyPlugins(workspace.id, destination, source).then(
        (plugins) => {
          changePlugins(plugins);
          if (operation.direction === "from") setKeyOperation(null);
        },
        () => {
          if (operation.direction === "from") setKeyOperation(null);
        },
      );
      return;
    }
    if (operation) return;
    if (key !== selectedKey) {
      setPreviewDownPluginId(null);
      setPreviewDownTarget(null);
    }
    setSelectedKey(key);
    if (key) setInspectorTab("properties");
  }

  function startDuplicateFrom() {
    if (!selectedKey) return;
    const operation = { direction: "from" as const, key: selectedKey };
    keyOperationRef.current = operation;
    setKeyOperation(operation);
  }

  function startDuplicateTo() {
    if (!selectedKey) return;
    const operation = { direction: "to" as const, key: selectedKey };
    keyOperationRef.current = operation;
    setKeyOperation(operation);
  }

  function startMoveTo() {
    if (!selectedKey) return;
    const operation = { direction: "move" as const, key: selectedKey };
    keyOperationRef.current = operation;
    setKeyOperation(operation);
  }

  async function clearSelectedKey() {
    if (!workspace || !selectedKey) return;
    const value = await clearKey(workspace.id, selectedKey);
    setWorkspace(value);
    setPreviewDownPluginId(null);
    setPreviewDownTarget(null);
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

          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            ml="auto"
            mr="md"
            aria-label="Settings"
            onClick={() => setSettingsOpened(true)}
          >
            <MdSettings size={20} />
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <SettingsModal
        opened={settingsOpened}
        onClose={() => setSettingsOpened(false)}
      />

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
                  key={`${geometry.id}-${workspace?.id ?? "none"}`}
                  layout={geometry.layout}
                  workspace={workspace}
                  selectedKey={selectedKey}
                  onSelectKey={selectKey}
                  previewDownPluginId={previewDownPluginId}
                  previewDownTarget={previewDownTarget}
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
                  aria-label="Zoom out"
                >
                  <MdRemove size={15} />
                </ActionIcon>

                <UnstyledButton
                  onClick={() => setZoom(100)}
                  style={{
                    minWidth: 44,
                    textAlign: "center",
                  }}
                  title="Reset to 100%"
                >
                  <Text size="xs">{zoom}%</Text>
                </UnstyledButton>

                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={zoomIn}
                  disabled={zoom >= MAX_ZOOM}
                  aria-label="Zoom in"
                >
                  <MdAdd size={15} />
                </ActionIcon>
              </Group>
            </Box>
          </Splitter.Pane>
          <Splitter.Pane defaultSize="550px" min="550px">
            <Inspector
              workspace={workspace}
              selectedKey={selectedKey}
              layout={geometry?.layout ?? null}
              tab={inspectorTab}
              onTabChange={setInspectorTab}
              onChange={changePlugins}
              onKeyPropertiesChange={changeKeyProperties}
              onPreviewDownPluginChange={setPreviewDownPluginId}
              onPreviewDownTargetChange={setPreviewDownTarget}
              onDuplicateFrom={startDuplicateFrom}
              onDuplicateTo={startDuplicateTo}
              onMoveTo={startMoveTo}
              onClearAll={clearSelectedKey}
            />
          </Splitter.Pane>
        </Splitter>
      </AppShell.Main>
      {keyOperation && (
        <Notification
          icon={
            keyOperation.direction === "move" ? (
              <MdDriveFileMove size={18} />
            ) : (
              <MdContentCopy size={18} />
            )
          }
          title={
            keyOperation.direction === "from"
              ? "Duplicate from"
              : keyOperation.direction === "to"
                ? "Duplicate to"
                : "Move to"
          }
          onClose={stopKeyOperation}
          withBorder
          style={{
            position: "fixed",
            left: 20,
            bottom: 20,
            zIndex: 1000,
          }}
        >
          <Group gap="md" wrap="nowrap">
            <Text size="sm">
              {keyOperation.direction === "from"
                ? "Click the source key to duplicate."
                : keyOperation.direction === "to"
                  ? "Click each destination key to duplicate."
                  : "Click the destination key to move."}
            </Text>
            <Button size="compact-xs" color="red" onClick={stopKeyOperation}>
              STOP
            </Button>
          </Group>
        </Notification>
      )}
    </AppShell>
  );
}
