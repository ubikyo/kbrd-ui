import { Box } from "@mantine/core";

type KeyboardPreviewProps = {
  svg: string;
  selectedKey: string | null;
  onSelectKey: (
    key: string | null,
  ) => void;
};

export default function KeyboardPreview({
  svg,
  selectedKey,
  onSelectKey,
}: KeyboardPreviewProps) {
  function handleClick(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    const target =
      event.target as Element;

    const key =
      target.closest<SVGPathElement>(
        ".kbrd-key",
      );

    if (!key) {
      onSelectKey(null);
      return;
    }

    const keyRef =
      key.dataset.key;

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
      className="keyboard-preview"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "auto",
        padding: 32,
      }}
    >
      <Box
        className="keyboard-svg"
        dangerouslySetInnerHTML={{
          __html: svg,
        }}
      />

      <style>
        {`
          .keyboard-svg {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .keyboard-svg svg {
            display: block;
            width: min(100%, 1400px);
            height: auto;
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