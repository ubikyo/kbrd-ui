import { Box } from "@mantine/core";

type PreviewProps = {
  svg: string;
  selectedKey: string | null;
  onSelectKey: (
    key: string | null,
  ) => void;
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

    const keyRef = key.dataset.key;

    if (!keyRef) {
      onSelectKey(null);
      return;
    }

    onSelectKey(keyRef);
  }

  return (
    <Box
      w="100%"
      h="100%"
      onClick={handleClick}
      style={{
        overflow: "auto",
      }}
    >
      {/* 60 px de marge extérieure */}
      <Box
        style={{
          minWidth: "100%",
          minHeight: "100%",
          padding: 60,

          display: "flex",
          alignItems: "center",
          justifyContent: "center",

          boxSizing: "border-box",
        }}
      >
        {/* Cadre de la preview */}
        <Box
          style={{
            border: "1px solid rgba(255, 255, 255, 1)",
            padding: 30,
            boxSizing: "border-box",
          }}
        >
          {/* Zoom */}
          <Box
            className="preview-svg"
            style={{
              width: `${zoom}%`,
              margin: "auto",
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
            height: auto;
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