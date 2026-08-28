import {
  createTheme,
  type CSSVariablesResolver,
  Menu,
  Modal,
  NumberInput,
  Splitter,
  Tabs,
} from "@mantine/core";

export const theme = createTheme({
  components: {
    NumberInput: NumberInput.extend({
      styles: {
        control: { "--control-border": "none" },
      },
    }),
    Tabs: Tabs.extend({
      vars: () => ({
        root: { "--tabs-color": "#FFFFFF" },
      }),
    }),
    Modal: Modal.extend({
      styles: {
        content: {
          backgroundColor: "var(--kbrd-color-body)",
          border: "1px solid var(--kbrd-border-color)",
        },
        header: { backgroundColor: "var(--kbrd-color-body)" },
        body: { backgroundColor: "var(--kbrd-color-body)" },
      },
    }),
    Menu: Menu.extend({
      styles: {
        dropdown: {
          border: "1px solid var(--kbrd-border-color)",
          backgroundColor: "var(--kbrd-color-body)",
          boxSizing: "border-box",
        },
        item: {
          padding: "var(--mantine-spacing-xs) var(--mantine-spacing-sm)",
          borderRadius: "var(--mantine-radius-xs)",
        },
      },
    }),
    Splitter: Splitter.extend({
      styles: {
        thumb: {
          backgroundColor: "#FFFFFF",
        },
      },
    }),
  },
});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    "--kbrd-color-body": "#000000",
    "--kbrd-color-surface": "#222120",
    "--kbrd-border-color": "#333333",
    "--kbrd-border-alt": "#FFFFFF",
  },
  light: {},
  dark: {},
});
