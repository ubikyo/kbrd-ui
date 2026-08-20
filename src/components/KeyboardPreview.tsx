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
          width: "max-content",
        }}
      >
        {geometry.map((row, rowIndex) => (
          <Box
            key={rowIndex}
            style={{
              display: "flex",
              height: keyHeight,
              flexShrink: 0,
            }}
          >
            {row.flatMap((item, itemIndex) =>
              Array.from(
                { length: item.quantity },
                (_, quantityIndex) => {
                  /*
                   * size représente l'espace physique occupé
                   * par la touche dans la géométrie.
                   */
                  const slotWidth = toPx(item.size, unit);

                  /*
                   * Le slot conserve exactement sa largeur.
                   *
                   * La touche dessinée est réduite de KEY_GAP
                   * afin de créer 3px entre deux slots sans
                   * modifier la largeur totale de la rangée.
                   */
                  const keyWidth = Math.max(
                    0,
                    slotWidth - KEY_GAP,
                  );

                  const rows = Math.max(1, item.rowspan || 1);

                  const keyHeightWithRowspan =
                    keyHeight * rows - KEY_GAP;

                  return (
                    <Box
                      key={`${rowIndex}-${itemIndex}-${quantityIndex}`}
                      style={{
                        width: slotWidth,
                        height: keyHeight,
                        flexShrink: 0,
                        position: "relative",
                      }}
                    >
                      <Box
                        style={{
                          position: "absolute",

                          left: KEY_GAP / 2,
                          top: KEY_GAP / 2,

                          width: keyWidth,
                          height: keyHeightWithRowspan,

                          border: "1px solid white",
                          borderRadius: 2,

                          boxSizing: "border-box",
                        }}
                      />
                    </Box>
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