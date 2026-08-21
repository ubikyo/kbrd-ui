import { Box } from "@mantine/core";
import { useEffect, useRef, useState } from "react";

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

  /*
   * Dimensions maximales du clavier à 100%.
   *
   * viewport
   * - 60px × 2 de marge extérieure
   * - 30px × 2 de padding intérieur
   * - 2px pour la bordure
   */
  const keyboardMaxWidth = Math.max(
    0,
    viewport.width -
      VIEWPORT_MARGIN * 2 -
      PREVIEW_PADDING * 2 -
      2,
  );

  const keyboardMaxHeight = Math.max(
    0,
    viewport.height -
      VIEWPORT_MARGIN * 2 -
      PREVIEW_PADDING * 2 -
      2,
  );

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
      {viewport.width > 0 &&
        viewport.height > 0 && (
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
             * L'objet complet est zoomé :
             *
             * bordure
             * + padding 30
             * + clavier
             */}
            <Box
              style={{
                display: "inline-flex",

                transform: `scale(${zoom / 100})`,
                transformOrigin: "center",

                flexShrink: 0,
              }}
            >
              {/* Cadre */}
              <Box
                style={{
                  display: "inline-flex",

                  padding: PREVIEW_PADDING,

                  border:
                    "1px solid rgba(255, 255, 255, 1)",

                  boxSizing: "content-box",
                }}
              >
                {/* Clavier */}
                <Box
                  className="keyboard-svg"
                  style={{
                    width: keyboardMaxWidth,
                    height: keyboardMaxHeight,

                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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

            /*
             * Le viewBox du SVG conserve
             * automatiquement le ratio du clavier.
             */
            object-fit: contain;
          }

          .keyboard-svg .kbrd-key {
            cursor: pointer;
            transition: stroke 100ms ease;
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