import { Box } from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";

import { pluginById, type PluginDefinition } from "../plugins/registry";
import { downState, effectiveConfig, upConfig } from "../plugins/state";
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
  previewDownPluginId: number | null;
  previewDownTarget: string | null;
};

type Size = {
  width: number;
  height: number;
};

const BACKGROUND_REF = "__background__";

function StatefulPluginRenderer({
  Renderer,
  config,
  pressed,
  pressToken,
  forceDown,
  geometry,
}: {
  Renderer: PluginDefinition["Renderer"];
  config: Record<string, unknown>;
  pressed: boolean;
  pressToken: number;
  forceDown: boolean;
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
    down.enabled &&
    (forceDown ||
      (pressed && (down.delay <= 0 || readyToken === pressToken)));

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
  previewDownPluginId,
  previewDownTarget,
}: PreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const keyboardRef = useRef<HTMLDivElement>(null);
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
    const root = keyboardRef.current;
    if (!root) return;
    const properties = new Map(
      (workspace?.key_properties ?? []).map((item) => [
        item.key_ref,
        item.config,
      ]),
    );
    root.querySelectorAll<SVGGraphicsElement>(".kbrd-key").forEach((element) => {
      const ref = element.dataset.key ?? "";
      const config = properties.get(ref);
      const down =
        Boolean(config?.downEnabled) &&
        (pressedKey === ref || previewDownTarget === ref);
      const borderEnabled = config?.borderEnabled ?? true;
      const legacyWidth = (config as { borderWidth?: number } | undefined)
        ?.borderWidth;
      const borderWidth = Math.max(
        1,
        Math.min(
          4,
          down
            ? (config?.downBorderWidth ?? legacyWidth ?? 1)
            : (config?.upBorderWidth ?? legacyWidth ?? 1),
        ),
      );
      const displayWidth = borderEnabled ? borderWidth : 1;
      element.setAttribute("fill", "#00000000");
      element.setAttribute(
        "stroke",
        borderEnabled
          ? down
            ? (config?.downBorderColor ?? "#ffffff")
            : (config?.upBorderColor ?? "#ffffff")
          : "none",
      );
      element.setAttribute("stroke-width", String(displayWidth));
      element.setAttribute("vector-effect", "non-scaling-stroke");

      if (element instanceof SVGRectElement) {
        const svg = element.ownerSVGElement;
        const bounds = svg?.getBoundingClientRect();
        const viewBox = svg?.viewBox.baseVal;
        const insetX =
          bounds?.width && viewBox
            ? (displayWidth / 2) * (viewBox.width / bounds.width)
            : 0;
        const insetY =
          bounds?.height && viewBox
            ? (displayWidth / 2) * (viewBox.height / bounds.height)
            : 0;
        const x = Number(element.dataset.x ?? element.getAttribute("x") ?? 0);
        const y = Number(element.dataset.y ?? element.getAttribute("y") ?? 0);
        const width = Number(
          element.dataset.width ?? element.getAttribute("width") ?? 0,
        );
        const height = Number(
          element.dataset.height ?? element.getAttribute("height") ?? 0,
        );
        element.setAttribute("x", String(x + insetX));
        element.setAttribute("y", String(y + insetY));
        element.setAttribute("width", String(Math.max(0, width - insetX * 2)));
        element.setAttribute(
          "height",
          String(Math.max(0, height - insetY * 2)),
        );
      }
    });
  }, [pressedKey, previewDownTarget, svg, workspace?.key_properties]);

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

  function keyFromEvent(
    target: EventTarget | null,
    clientX: number,
    clientY: number,
  ) {
    const direct = (target as Element | null)?.closest<SVGElement>(
      ".kbrd-key",
    )?.dataset.key;
    if (direct) return direct;

    const keyboard = viewportRef.current?.querySelector<HTMLElement>(
      ".keyboard-svg",
    );
    const frame = viewportRef.current?.querySelector<HTMLElement>(
      ".keyboard-frame",
    );
    if (!keyboard || !frame) return undefined;
    const bounds = keyboard.getBoundingClientRect();
    if (
      clientX >= bounds.left &&
      clientX <= bounds.right &&
      clientY >= bounds.top &&
      clientY <= bounds.bottom
    ) {
      const x = ((clientX - bounds.left) / bounds.width) * layout.width;
      const y = ((clientY - bounds.top) / bounds.height) * layout.height;
      const key = [...layout.keys]
        .reverse()
        .find(
          (item) =>
            x >= item.x &&
            x <= item.x + item.width &&
            y >= item.y &&
            y <= item.y + item.height,
        );
      if (key) return key.ref;
    }

    const frameBounds = frame.getBoundingClientRect();
    return clientX >= frameBounds.left &&
      clientX <= frameBounds.right &&
      clientY >= frameBounds.top &&
      clientY <= frameBounds.bottom
      ? BACKGROUND_REF
      : undefined;
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    onSelectKey(
      keyFromEvent(event.target, event.clientX, event.clientY) ?? null,
    );
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    const key = keyFromEvent(event.target, event.clientX, event.clientY);
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
    const key = keyFromEvent(event.target, event.clientX, event.clientY);
    const pluginId = event.dataTransfer.getData("application/kbrd-plugin");
    if (!key || !pluginId) return;
    event.preventDefault();
    setDropTargetKey(null);
    onSelectKey(key);
    onDropPlugin(key, pluginId);
  }

  function renderPlugins(onBackground: boolean) {
    return (workspace?.plugins ?? [])
      .filter(
        (instance) =>
          instance.enabled &&
          (instance.key_ref === BACKGROUND_REF) === onBackground,
      )
      .sort((left, right) => left.position - right.position)
      .map((instance) => {
        const horizontalPadding = keyboardSize
          ? (PREVIEW_PADDING / keyboardSize.width) * layout.width
          : 0;
        const verticalPadding = keyboardSize
          ? (PREVIEW_PADDING / keyboardSize.height) * layout.height
          : 0;
        const geometry = onBackground
          ? {
              x: -horizontalPadding,
              y: -verticalPadding,
              width: layout.width + horizontalPadding * 2,
              height: layout.height + verticalPadding * 2,
              ref: BACKGROUND_REF,
              name: "Background",
              parts: [],
              type: "space" as const,
            }
          : layout.keys.find((item) => item.ref === instance.key_ref);
        const plugin = pluginById(instance.plugin_id);
        if (!geometry || !plugin) return null;
        const Renderer = plugin.Renderer;
        if (onBackground) {
          return (
            <Renderer
              key={instance.id}
              config={upConfig(instance.config)}
              {...geometry}
            />
          );
        }
        return (
          <StatefulPluginRenderer
            key={instance.id}
            Renderer={Renderer}
            config={instance.config}
            geometry={geometry}
            pressed={pressedKey === instance.key_ref}
            pressToken={pressToken}
            forceDown={previewDownPluginId === instance.id}
          />
        );
      });
  }

  return (
    <Box
      ref={viewportRef}
      w="100%"
      h="100%"
      onClick={handleClick}
      onPointerDown={(event) => {
        const key =
          keyFromEvent(event.target, event.clientX, event.clientY) ?? null;
        setPressedKey(key);
        onSelectKey(key);
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
              className="keyboard-frame"
              style={{
                display: "block",
                position: "relative",

                padding: PREVIEW_PADDING,

                border: `${BORDER_WIDTH}px solid rgba(255, 255, 255, 1)`,

                boxSizing: "content-box",
                overflow: "hidden",
              }}
            >
              <svg
                viewBox={`${
                  -(PREVIEW_PADDING / keyboardSize.width) * layout.width
                } ${
                  -(PREVIEW_PADDING / keyboardSize.height) * layout.height
                } ${
                  layout.width +
                  2 * (PREVIEW_PADDING / keyboardSize.width) * layout.width
                } ${
                  layout.height +
                  2 * (PREVIEW_PADDING / keyboardSize.height) * layout.height
                }`}
                aria-hidden="true"
                className="keyboard-plugin-layer"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  zIndex: 0,
                }}
              >
                {renderPlugins(true)}
              </svg>
              <Box
                ref={keyboardRef}
                className="keyboard-svg"
                style={{
                  width: keyboardSize.width,
                  height: keyboardSize.height,
                  position: "relative",
                  lineHeight: 0,
                  zIndex: 1,
                }}
              >
                <Box
                  style={{ position: "relative", zIndex: 1 }}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
                <svg
                  className="keyboard-plugin-layer"
                  viewBox={`0 0 ${layout.width} ${layout.height}`}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    overflow: "visible",
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                >
                  {renderPlugins(false)}
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
          }

          .keyboard-svg .keyboard-plugin-layer,
          .keyboard-svg .keyboard-plugin-layer * {
            pointer-events: none !important;
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
