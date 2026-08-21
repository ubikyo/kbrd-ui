import { Box } from "@mantine/core";

type PreviewProps = {
  svg: string;
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
  zoom: number;
};

export default function Preview({
  svg,
  selectedKey,
  onSelectKey,
  zoom,
}: PreviewProps) {
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
      w="100%"
      h="100%"
      onClick={handleClick}
      style={{
        position: "relative",
        overflow: "auto",
      }}
    >
      {/*
        Zone disponible pour la preview.

        Les 60 px sont la marge entre le viewport
        et le cadre de la preview.
      */}
      <Box
        style={{
          position: "absolute",
          inset: 60,

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          overflow: "visible",
        }}
      >
        {/*
          Ce bloc représente l'objet zoomé complet :
          bordure + padding + clavier.
        */}
        <Box
          style={{
            display: "inline-flex",

            maxWidth: "100%",
            maxHeight: "100%",

            transform: `scale(${zoom / 100})`,
            transformOrigin: "center",

            boxSizing: "border-box",
          }}
        >
          {/*
            Le cadre est exactement à 30 px
            autour du clavier.
          */}
          <Box
            style={{
              display: "inline-flex",

              padding: 30,

              border:
                "1px solid rgba(255, 255, 255, 1)",

              boxSizing: "border-box",
            }}
          >
            <Box
              className="keyboard-svg"
              dangerouslySetInnerHTML={{
                __html: svg,
              }}
            />
          </Box>
        </Box>
      </Box>

      <style>
        {`
          .keyboard-svg {
            display: flex;
            flex: 0 0 auto;
          }

          .keyboard-svg svg {
            display: block;

            /*
             * Le SVG conserve ses dimensions/ratio
             * intrinsèques.
             */
            width: auto;
            height: auto;

            /*
             * La taille maximale tient compte de :
             *
             * 60 px viewport gauche/droite
             * 30 px padding gauche/droite
             *
             * Même principe verticalement.
             */
            max-width: calc(100vw - 180px);
            max-height: calc(100vh - 244px);

            overflow: visible;
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