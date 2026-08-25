import { Box } from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";

import { pluginById, type PluginDefinition } from "../plugins/registry";
import { downState, effectiveConfig } from "../plugins/state";
import type { GeometryLayout } from "../types/geometry";
import type { WorkspaceData } from "../types/workspace";

type PreviewProps = {
  svg: string;
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
  zoom: number;
  layout: GeometryLayout;
  workspace: WorkspaceData | null;
  onDropPlugin: (key: string, pluginId: string) => void;
};

type Size = {
  width: number;
  height: number;
};

function StatefulPluginRenderer({
  Renderer,
  config,
  pressed,
  pressToken,
  geometry,
}: {
  Renderer: PluginDefinition["Renderer"];
  config: Record<string, unknown>;
  pressed: boolean;
  pressToken: number;
  geometry: GeometryLayout["keys"][number];
}) {
  const [readyToken, setReadyToken] = useState<number | null>(null);
  const down = downState(config);

  useEffect(() => {
    if (!pressed || !down.enabled || down.delay <= 0) return;
    const timer = window.setTimeout(() => setReadyToken(pressToken), down.delay);
    return () => window.clearTimeout(timer);
  }, [pressed, pressToken, down.enabled, down.delay]);

  const downVisible =
    pressed &&
    down.enabled &&
    (down.delay <= 0 || readyToken === pressToken);

  return <Renderer config={effectiveConfig(config, downVisible)} {...geometry} />;
}

const VIEWPORT_MARGIN = 60;
const PREVIEW_PADDING = 30;
const BORDER_WIDTH = 1;

export default function Preview({
  svg,
  selectedKey,
  onSelectKey,
  zoom,
  layout,
  workspace,
  onDropPlugin,
}: PreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const selectedKeySelector = CSS.escape(selectedKey ?? "");

  const [viewport, setViewport] = useState<Size>({
    width: 0,
    height: 0,
  });
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [pressToken, setPressToken] = useState(0);

  /*
   * Récupère les dimensions natives du SVG depuis son viewBox.
   */
  const svgSize = useMemo(() => {
    const match = svg.match(
      /viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i,
    );

    if (!match) {
      return null;
    }

    return {
      width: Number(match[3]),
      height: Number(match[4]),
    };
  }, [svg]);

  /*
   * Surveillance du viewport.
   */
  useEffect(() => {
    const element = viewportRef.current;

    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const release = () => setPressedKey(null);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

  useEffect(() => {
    const clearDropTarget = () => setDropTargetKey(null);
    window.addEventListener("dragend", clearDropTarget);
    window.addEventListener("drop", clearDropTarget);
    return () => {
      window.removeEventListener("dragend", clearDropTarget);
      window.removeEventListener("drop", clearDropTarget);
    };
  }, []);

  /*
   * Calcule les dimensions du clavier en respectant :
   *
   * viewport
   *   60px marge
   *   border
   *     30px padding
   *       clavier
   *     30px padding
   *   border
   *   60px marge
   *
   * Le ratio du SVG est conservé.
   */
  const keyboardSize = useMemo(() => {
    if (!svgSize || viewport.width <= 0 || viewport.height <= 0) {
      return null;
    }

    const availableWidth =
      viewport.width -
      VIEWPORT_MARGIN * 2 -
      PREVIEW_PADDING * 2 -
      BORDER_WIDTH * 2;

    const availableHeight =
      viewport.height -
      VIEWPORT_MARGIN * 2 -
      PREVIEW_PADDING * 2 -
      BORDER_WIDTH * 2;

    if (availableWidth <= 0 || availableHeight <= 0) {
      return null;
    }

    const ratio = svgSize.width / svgSize.height;

    let width = availableWidth;
    let height = width / ratio;

    /*
     * Si on dépasse verticalement,
     * c'est la hauteur qui devient limitante.
     */
    if (height > availableHeight) {
      height = availableHeight;
      width = height * ratio;
    }

    return {
      width,
      height,
    };
  }, [svgSize, viewport]);

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as Element;

    const key = target.closest<SVGElement>(".kbrd-key");

    if (!key) {
      onSelectKey(null);
      return;
    }

    onSelectKey(key.dataset.key ?? null);
  }

  function keyFromEvent(target: EventTarget | null) {
    return (target as Element | null)?.closest<SVGElement>(".kbrd-key")?.dataset
      .key;
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    const key = keyFromEvent(event.target);
    if (!workspace || !key) {
      setDropTargetKey(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropTargetKey(key);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDropTargetKey(null);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    if (!workspace) return;
    const key = keyFromEvent(event.target);
    const pluginId = event.dataTransfer.getData("application/kbrd-plugin");
    if (!key || !pluginId) return;
    event.preventDefault();
    setDropTargetKey(null);
    onSelectKey(key);
    onDropPlugin(key, pluginId);
  }

  return (
    <Box
      ref={viewportRef}
      w="100%"
      h="100%"
      onClick={handleClick}
      onPointerDown={(event) => {
        setPressedKey(keyFromEvent(event.target) ?? null);
        setPressToken((value) => value + 1);
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        position: "relative",
        overflow: "auto",
      }}
    >
      {keyboardSize && (
        <Box
          style={{
            position: "absolute",

            inset: VIEWPORT_MARGIN,

            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/*
           * Tout ce bloc zoome ensemble :
           *
           * border
           * padding
           * SVG
           */}
          <Box
            style={{
              display: "inline-block",

              transform: `scale(${zoom / 100})`,
              transformOrigin: "center center",

              flexShrink: 0,
            }}
          >
            <Box
              style={{
                display: "block",

                padding: PREVIEW_PADDING,

                border: `${BORDER_WIDTH}px solid rgba(255, 255, 255, 1)`,

                boxSizing: "content-box",
              }}
            >
              <Box
                className="keyboard-svg"
                style={{
                  width: keyboardSize.width,
                  height: keyboardSize.height,
                  position: "relative",
                  lineHeight: 0,
                }}
              >
                <Box dangerouslySetInnerHTML={{ __html: svg }} />
                <svg
                  viewBox={`0 0 ${layout.width} ${layout.height}`}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    overflow: "visible",
                    pointerEvents: "none",
                  }}
                >
                  {(workspace?.plugins ?? [])
                    .filter((instance) => instance.enabled)
                    .sort((left, right) => left.position - right.position)
                    .map((instance) => {
                      const key = layout.keys.find(
                        (item) => item.ref === instance.key_ref,
                      );
                      const plugin = pluginById(instance.plugin_id);
                      if (!key || !plugin) return null;
                      const Renderer = plugin.Renderer;
                      return (
                        <StatefulPluginRenderer
                          key={instance.id}
                          Renderer={Renderer}
                          config={instance.config}
                          geometry={key}
                          pressed={pressedKey === instance.key_ref}
                          pressToken={pressToken}
                        />
                      );
                    })}
                </svg>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      <style>
        {`
          .keyboard-svg svg {
            display: block;

            width: 100%;
            height: 100%;

            overflow: visible;
          }

          .keyboard-svg .kbrd-key {
            cursor: pointer;
            transition: stroke 100ms ease;
            fill: rgba(0, 0, 0, 0);
          }

          .keyboard-svg .kbrd-key:hover {
            stroke: rgba(255, 255, 255, 0.75);
          }

          .keyboard-svg .kbrd-key[data-key="${selectedKeySelector}"] {
            stroke: rgba(255, 255, 255, 1);
          }

          .keyboard-svg .kbrd-key[data-key="${CSS.escape(dropTargetKey ?? "")}"] {
            stroke: rgba(255, 255, 255, 1);
          }
        `}
      </style>
    </Box>
  );
}
