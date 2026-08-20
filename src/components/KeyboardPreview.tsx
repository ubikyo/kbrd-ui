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

type Key = {
  id: string;
  name: string;

  row: number;
  index: number;

  x: number;
  y: number;

  width: number;
  height: number;

  rowspan: number;
  colspan: number;
};

const MM_TO_PX = 96 / 25.4;

const KEY_HEIGHT_MM = 16;
const KEY_GAP_MM = 3;

function toPx(value: number, unit: "px" | "mm") {
  return unit === "mm" ? value * MM_TO_PX : value;
}

export default function KeyboardPreview({
  geometry,
  unit,
}: KeyboardPreviewProps) {
  const keyHeight = toPx(KEY_HEIGHT_MM, unit);
  const gap = toPx(KEY_GAP_MM, unit);

  /*
   * Construction de toutes les touches avec leurs
   * coordonnées absolues.
   */
  const rows: Key[][] = geometry.map((row, rowIndex) => {
    const keys: Key[] = [];

    let x = 0;
    let keyIndex = 0;

    row.forEach((item, itemIndex) => {
      for (let q = 0; q < item.quantity; q++) {
        const width = toPx(item.size, unit);

        keys.push({
          id: `${rowIndex}-${itemIndex}-${q}`,

          name: item.name,

          row: rowIndex,
          index: keyIndex,

          x,
          y: rowIndex * (keyHeight + gap),

          width,
          height: keyHeight,

          rowspan: item.rowspan,
          colspan: item.colspan,
        });

        x += width + gap;
        keyIndex++;
      }
    });

    return keys;
  });

  const allKeys = rows.flat();

  /*
   * Les touches absorbées par un rowspan/colspan
   * ne doivent pas être dessinées séparément.
   */
  const consumed = new Set<string>();

  /*
   * Recherche de la touche située dans la rangée suivante
   * et connectée géométriquement à la touche courante.
   *
   * Si un nom est défini (ex: enter), on privilégie
   * l'élément portant le même nom.
   */
  function findBelow(key: Key): Key | undefined {
    const nextRow = rows[key.row + 1];

    if (!nextRow) {
      return undefined;
    }

    if (key.name) {
      const sameName = nextRow.find(
        (candidate) => candidate.name === key.name,
      );

      if (sameName) {
        return sameName;
      }
    }

    /*
     * Sinon recherche par intersection horizontale.
     */
    return nextRow.find((candidate) => {
      const left = Math.max(key.x, candidate.x);
      const right = Math.min(
        key.x + key.width,
        candidate.x + candidate.width,
      );

      return right > left;
    });
  }

  /*
   * Création du path SVG d'une touche.
   *
   * Pour une touche normale : rectangle.
   *
   * Pour rowspan : union de la partie supérieure
   * et de la partie inférieure.
   */
  function createPath(key: Key) {
    /*
     * Touche normale
     */
    if (key.rowspan <= 0) {
      return `
        M ${key.x} ${key.y}
        H ${key.x + key.width}
        V ${key.y + key.height}
        H ${key.x}
        Z
      `;
    }

    const below = findBelow(key);

    if (!below) {
      return `
        M ${key.x} ${key.y}
        H ${key.x + key.width}
        V ${key.y + key.height}
        H ${key.x}
        Z
      `;
    }

    consumed.add(below.id);

    /*
     * On construit l'union des deux rectangles.
     *
     * Cas de Enter :
     *
     * ┌───────────────┐
     * │               │
     * └─────┐         │
     *       │         │
     *       └─────────┘
     */

    const topLeft = key.x;
    const topRight = key.x + key.width;

    const bottomLeft = below.x;
    const bottomRight = below.x + below.width;

    const topY = key.y;
    const middleTopY = key.y + key.height;
    const bottomY = below.y + below.height;

    /*
     * Cas correspondant à ton Enter :
     * même bord droit, partie inférieure plus étroite.
     */
    if (
      Math.abs(topRight - bottomRight) < 1 &&
      bottomLeft >= topLeft
    ) {
      return `
        M ${topLeft} ${topY}
        H ${topRight}
        V ${bottomY}
        H ${bottomLeft}
        V ${middleTopY}
        H ${topLeft}
        Z
      `;
    }

    /*
     * Cas inverse :
     * même bord gauche.
     */
    if (
      Math.abs(topLeft - bottomLeft) < 1 &&
      bottomRight <= topRight
    ) {
      return `
        M ${topLeft} ${topY}
        H ${topRight}
        V ${middleTopY}
        H ${bottomRight}
        V ${bottomY}
        H ${bottomLeft}
        V ${topY}
        Z
      `;
    }

    /*
     * Cas générique : on englobe les deux éléments.
     */
    const left = Math.min(topLeft, bottomLeft);
    const right = Math.max(topRight, bottomRight);

    return `
      M ${left} ${topY}
      H ${right}
      V ${bottomY}
      H ${left}
      Z
    `;
  }

  /*
   * Calcul de la largeur totale.
   */
  const width = Math.max(
    ...rows.map((row) => {
      const last = row[row.length - 1];

      return last ? last.x + last.width : 0;
    }),
    0,
  );

  const height =
    geometry.length * keyHeight +
    Math.max(0, geometry.length - 1) * gap;

  /*
   * Il faut construire les paths avant le rendu afin
   * de remplir "consumed".
   */
  const renderedKeys = allKeys.map((key) => ({
    key,
    path: createPath(key),
  }));

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
        component="svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          display: "block",
          flexShrink: 0,
          overflow: "visible",
        }}
      >
        {renderedKeys.map(({ key, path }) => {
          if (consumed.has(key.id)) {
            return null;
          }

          return (
            <path
              key={key.id}
              d={path}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.5)"
              strokeWidth={1}
              strokeLinejoin="round"
            />
          );
        })}
      </Box>
    </Center>
  );
}