import {
  Box,
  Divider,
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

const PANEL_MARGIN = 12;

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

        marginTop: PANEL_MARGIN,
        marginBottom: PANEL_MARGIN,

        backgroundColor:
          "var(--mantine-color-dark-7)",

        borderTop:
          "1px solid var(--mantine-color-dark-5)",

        borderBottom:
          "1px solid var(--mantine-color-dark-5)",

        borderLeft:
          "1px solid var(--mantine-color-dark-5)",
      }}
    >
      {/* Zone permettant de saisir la bordure */}
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

      {/* Poignée visible */}
      <Box
        onMouseDown={startResize}
        style={{
          position: "absolute",
          left: -3,
          top: "50%",
          transform: "translateY(-50%)",

          width: 5,
          height: 36,

          borderRadius: 3,

          backgroundColor:
            "var(--mantine-color-gray-5)",

          cursor: "col-resize",
          zIndex: 21,
        }}
      />

      <Box
        px="md"
        py="sm"
      >
        <Title order={5}>
          Properties
        </Title>
      </Box>

      <Divider />

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