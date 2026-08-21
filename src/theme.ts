import {
  createTheme,
  type CSSVariablesResolver,
} from "@mantine/core";

export const theme = createTheme({});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    "--mantine-color-body": "#000000",
    "--kbrd-color-surface": "#222120",
  },
  light: {},
  dark: {},
});
