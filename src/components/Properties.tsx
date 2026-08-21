import {
  Box,
  Text,
  Title,
} from "@mantine/core";
import { useState } from "react";

type PropertiesProps = {
  selectedKey: string | null;
};

const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 240;
const MAX_WIDTH = 600;

export default function Properties({
  selectedKey,
}: PropertiesProps) {
  const [width, setWidth] =
    useState(DEFAULT_WIDTH);

  function startResize(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = width;

    function handleMouseMove(
      event: MouseEvent,
    ) {
      const delta =
        startX - event.clientX;

      const nextWidth =
        Math.min(
          MAX_WIDTH,
          Math.max(
            MIN_WIDTH,
            startWidth + delta,
          ),
        );

      setWidth(nextWidth);
    }

    function handleMouseUp() {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      window.removeEventListener(
        "mousemove",
        handleMouseMove,
      );

      window.removeEventListener(
        "mouseup",
        handleMouseUp,
      );
    }

    document.body.style.cursor =
      "col-resize";

    document.body.style.userSelect =
      "none";

    window.addEventListener(
      "mousemove",
      handleMouseMove,
    );

    window.addEventListener(
      "mouseup",
      handleMouseUp,
    );
  }

  return (
    <Box
      w={width}
      style={{
        position: "relative",
        flexShrink: 0,
        backgroundColor: "var(--kbrd-color-body)",
        borderLeft: "1px solid var(--mantine-color-dark-7)",
      }}
    >
      {/* Zone de redimensionnement */}
      <Box
        onMouseDown={startResize}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: -5,
          width: 10,
          cursor: "col-resize",
          zIndex: 20,
        }}
      />

      {/* Poignée */}
      <Box
        onMouseDown={startResize}
        style={{
          position: "absolute",

          left: -8,
          top: "50%",

          transform: "translateY(-50%)",

          width: 3,
          height: 36,

          borderRadius: 0,

          backgroundColor:
            "var(--mantine-color-gray-5)",

          cursor: "col-resize",
          zIndex: 21,
        }}
      />

      <Box
        px="md"
        pt="md"
        pb="sm"
      >
        <Title order={5}>
          Properties
        </Title>
      </Box>

      <Box p="md">
        {selectedKey ? (
          <>
            <Text
              size="xs"
              c="dimmed"
              mb={4}
            >
              Référence
            </Text>

            <Text
              fw={500}
              ff="monospace"
            >
              {selectedKey}
            </Text>
          </>
        ) : (
          <Text
            size="sm"
            c="dimmed"
          >
            Aucune touche sélectionnée
          </Text>
        )}
      </Box>
    </Box>
  );
}
