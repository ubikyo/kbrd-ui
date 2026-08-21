import {
  createTheme,
  type CSSVariablesResolver,
} from "@mantine/core";

export const theme = createTheme({});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    "--kbrd-color-body": "#000000",
    "--kbrd-color-surface": "#222120",
    "--kbrd-border-color": "#333333",
  },
  light: {},
  dark: {},
});
