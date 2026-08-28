import {
  ActionIcon,
  AppShell,
  Box,
  Button,
  Group,
  Notification,
  Splitter,
  Text,
} from "@mantine/core";

import {
  MdContentCopy,
  MdDriveFileMove,
  MdSettings,
} from "react-icons/md";

import { useCallback, useEffect, useRef, useState } from "react";

import kbrdLogo from "./assets/media/KBRD.svg";

import type { GeometryData } from "./types/geometry";
import { getActiveGeometry } from "./api/geometries";

import Factory from "./components/Factory";
import Inspector from "./components/Inspector";
import SettingsModal from "./components/SettingsModal";
import Workspace from "./components/Workspace";
import { clearKey } from "./api/workspaces";
import type {
  KeyPlugin,
  KeyProperty,
  WorkspaceData,
} from "./types/workspace";

export default function App() {
  const [geometry, setGeometry] = useState<GeometryData | null>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);

  const [settingsOpened, setSettingsOpened] = useState(false);

  const [inspectorTab, setInspectorTab] = useState<string | null>("plugins");
  // TODO(preview-rebuild): only the setters are used until <Factory> reads
  // these back to force-render a key/plugin's down state, as <Preview> did.
  const [, setPreviewDownPluginId] = useState<number | null>(null);
  const [, setPreviewDownTarget] = useState<string | null>(null);
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
  }, []);

  // The geometry picker is gone: load whichever geometry KBRD-API resolves
  // as current (the active one, "default" by name, or the first
  // alphabetically — see `kbrd_api.api.geometry.Geometry.find_default`).
  useEffect(() => {
    let cancelled = false;
    getActiveGeometry().then(
      (value) => {
        if (!cancelled) changeGeometry(value);
      },
      () => {
        if (!cancelled) changeGeometry(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [changeGeometry]);

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

  // TODO(preview-rebuild): dropping a plugin onto a key and completing a
  // duplicate/move operation both used to happen by clicking a key in
  // <Preview>. Restore that wiring (see git history / Preview.tsx) once
  // <Factory> exposes clickable key/drop targets of its own.

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
              {/* TODO(preview-rebuild): Factory temporarily stands in for
                  Preview while that component is redesigned from scratch. */}
              <Factory />
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
