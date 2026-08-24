import { Box } from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";

type PreviewProps = {
  svg: string;
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
  zoom: number;
};

type Size = {
  width: number;
  height: number;
};

const VIEWPORT_MARGIN = 60;
const PREVIEW_PADDING = 30;
const BORDER_WIDTH = 1;

export default function Preview({
  svg,
  selectedKey,
  onSelectKey,
  zoom,
}: PreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);

  const [viewport, setViewport] = useState<Size>({
    width: 0,
    height: 0,
  });

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
    if (
      !svgSize ||
      viewport.width <= 0 ||
      viewport.height <= 0
    ) {
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

  function handleClick(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    const target = event.target as Element;

    const key = target.closest<SVGElement>(
      ".kbrd-key",
    );

    if (!key) {
      onSelectKey(null);
      return;
    }

    onSelectKey(key.dataset.key ?? null);
  }

  return (
    <Box
      ref={viewportRef}
      w="100%"
      h="100%"
      onClick={handleClick}
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

                  lineHeight: 0,
                }}
                dangerouslySetInnerHTML={{
                  __html: svg,
                }}
              />
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

          .keyboard-svg .kbrd-key[data-key="${selectedKey ?? ""}"] {
            stroke: rgba(255, 255, 255, 1);
          }
        `}
      </style>
    </Box>
  );
}