import { Box } from "@mantine/core";

type Props = {
  width: number;
  height: number;
};

/** One placeholder item in the grid `<Factory>` lays out over the display. */
export default function LayoutItem({ width, height }: Props) {
  return (
    <Box
      style={{
        width,
        height,
        boxSizing: "border-box",
        border: "1px solid var(--kbrd-border-alt)",
      }}
    />
  );
}
