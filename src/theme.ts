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
  // Mantine's own dark-7 default doesn't match the pure black this app
  // paints everywhere via `--kbrd-color-body` — most surfaces already
  // override it explicitly (see the `Modal`/`Menu` extensions above), but
  // a few effects, like `<Tabs variant="outline">`'s active-tab border,
  // blend into whatever this resolves to rather than something we can
  // style directly. Matching it here fixes those for free — it has to
  // live under `dark` rather than the shared `variables` above: Mantine's
  // own dark-scheme rule targets `:root[data-mantine-color-scheme="dark"]`,
  // more specific than a plain `:root` and thus not overridable from there.
  dark: {
    "--mantine-color-body": "var(--kbrd-color-body)",
  },
});
