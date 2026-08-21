import {
  createTheme,
  type CSSVariablesResolver,
} from "@mantine/core";

export const theme = createTheme({});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    "--mantine-color-body": "#000000",
  },
  dark: {
    "--mantine-color-body": "#000000",
  },
});
