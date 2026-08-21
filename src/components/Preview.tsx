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

    const key =
      target.closest<SVGElement>(".kbrd-key");

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
       * 60 px minimum entre la preview
       * et les limites du viewport
       */}
      <Box
        style={{
          position: "absolute",
          inset: 60,

          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/*
         * Le zoom concerne tout :
         * clavier + padding + bordure
         */}
        <Box
          style={{
            width: "100%",
            height: "100%",

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            transform: `scale(${zoom / 100})`,
            transformOrigin: "center",
          }}
        >
          {/*
           * Ce bloc prend les dimensions
           * naturelles du clavier.
           *
           * La bordure se trouve toujours
           * à 30 px du SVG.
           */}
          <Box
            className="preview-frame"
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
          /*
           * Le SVG utilise au maximum le viewport
           * disponible, en conservant son ratio.
           */
          .preview-frame {
            max-width: 100%;
            max-height: 100%;
          }

          .keyboard-svg {
            display: flex;
            align-items: center;
            justify-content: center;

            max-width: 100%;
            max-height: 100%;
          }

          .keyboard-svg svg {
            display: block;

            width: auto;
            height: auto;

            max-width: 100%;
            max-height: 100%;

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