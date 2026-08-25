import {
  createTheme,
  type CSSVariablesResolver,
  Menu
} from "@mantine/core";

export const theme = createTheme({
  components: {
    Menu: Menu.extend({
      styles: {
        dropdown: {
          borderRadius: "0 0 8px 8px",
          border: "1px solid var(--kbrd-border-color)",
          backgroundColor: "var(--kbrd-color-body)",
          borderTop: "none",
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
  },
  light: {},
  dark: {},
});