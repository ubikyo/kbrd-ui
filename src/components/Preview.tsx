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

    const keyRef = key.dataset.key;

    onSelectKey(keyRef ?? null);
  }

  return (
    <Box
      w="100%"
      h="100%"
      onClick={handleClick}
      style={{
        padding: 60,
        boxSizing: "border-box",
      }}
    >
      {/* Preview */}
      <Box
        w="100%"
        h="100%"
        style={{
          position: "relative",

          border:
            "1px solid rgba(255, 255, 255, 1)",

          padding: 30,

          boxSizing: "border-box",

          overflow: "auto",
        }}
      >
        {/* Surface disponible pour le clavier */}
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
            className="preview-svg"
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
      </Box>

      <style>
        {`
          .preview-svg svg {
            display: block;

            width: 100%;
            height: 100%;

            max-width: 100%;
            max-height: 100%;

            object-fit: contain;

            overflow: visible;
          }

          .preview-svg .kbrd-key {
            cursor: pointer;
            transition: stroke 100ms ease;
          }

          .preview-svg .kbrd-key:hover {
            stroke: rgba(255, 255, 255, 0.75);
          }

          .preview-svg .kbrd-key[data-key="${selectedKey ?? ""}"] {
            stroke: rgba(255, 255, 255, 1);
          }
        `}
      </style>
    </Box>
  );
}