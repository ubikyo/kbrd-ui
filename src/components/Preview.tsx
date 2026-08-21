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

        /*
         * Marge extérieure du viewport.
         */
        padding: 60,

        boxSizing: "border-box",
      }}
    >
      <Box
        w="100%"
        h="100%"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          overflow: "visible",
        }}
      >
        <Box
          className="keyboard-preview"
          style={{
            width: `${zoom}%`,
            height: `${zoom}%`,

            display: "flex",
            alignItems: "center",
            justifyContent: "center",

            flexShrink: 0,
          }}
          dangerouslySetInnerHTML={{
            __html: svg,
          }}
        />
      </Box>

      <style>
        {`
          .keyboard-preview svg {
            display: block;

            width: 100%;
            height: 100%;

            /*
             * Le ratio du SVG décide si c'est
             * la largeur ou la hauteur qui limite.
             */
            object-fit: contain;

            overflow: visible;
          }

          .keyboard-preview .kbrd-key {
            cursor: pointer;
            transition: stroke 100ms ease;
          }

          .keyboard-preview .kbrd-key:hover {
            stroke: rgba(255, 255, 255, 0.75);
          }

          .keyboard-preview .kbrd-key[data-key="${selectedKey ?? ""}"] {
            stroke: rgba(255, 255, 255, 1);
          }
        `}
      </style>
    </Box>
  );
}