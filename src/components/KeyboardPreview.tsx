import { Box, Center } from "@mantine/core";

export type GeometryItem = {
  name: string;
  rowspan: number;
  colspan: number;
  size: number;
  quantity: number;
};

type KeyboardPreviewProps = {
  geometry: GeometryItem[][];
  unit: "px" | "mm";
};

const MM_TO_PX = 96 / 25.4;
const KEY_GAP = 3;
const KEY_HEIGHT_MM = 16;

function toPx(value: number, unit: "px" | "mm") {
  return unit === "mm" ? value * MM_TO_PX : value;
}

export default function KeyboardPreview({
  geometry,
  unit,
}: KeyboardPreviewProps) {
  const keyHeight = toPx(KEY_HEIGHT_MM, unit);

  return (
    <Center
      w="100%"
      h="100%"
      p="xl"
      style={{
        overflow: "auto",
      }}
    >
      <Box
        style={{
          display: "flex",
          flexDirection: "column",
          gap: KEY_GAP,
          width: "max-content",
        }}
      >
        {geometry.map((row, rowIndex) => (
          <Box
            key={rowIndex}
            style={{
              display: "flex",
              gap: KEY_GAP,
              alignItems: "flex-start",
            }}
          >
            {row.flatMap((item, itemIndex) =>
              Array.from(
                { length: item.quantity },
                (_, quantityIndex) => {
                  const width = toPx(item.size, unit);

                  /*
                   * rowspan :
                   * la touche se prolonge vers la rangée précédente.
                   *
                   * colspan :
                   * la touche se prolonge vers la droite.
                   */
                  const height =
                    item.rowspan > 1
                      ? keyHeight * item.rowspan +
                        KEY_GAP * (item.rowspan - 1)
                      : keyHeight;

                  const colspanWidth =
                    item.colspan > 1
                      ? width * item.colspan +
                        KEY_GAP * (item.colspan - 1)
                      : width;

                  return (
                    <Box
                      key={`${rowIndex}-${itemIndex}-${quantityIndex}`}
                      style={{
                        width: colspanWidth,
                        height,
                        flexShrink: 0,

                        border: "1px solid white",
                        borderRadius: 2,

                        /*
                         * rowspan se connecte vers le haut.
                         */
                        marginTop:
                          item.rowspan > 1
                            ? -(keyHeight + KEY_GAP) *
                              (item.rowspan - 1)
                            : 0,
                      }}
                    />
                  );
                },
              ),
            )}
          </Box>
        ))}
      </Box>
    </Center>
  );
}