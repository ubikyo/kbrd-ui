import { Switch } from "@mantine/core";
import { Border, Color, type BorderValue } from "@kbrd/plugins/web";
import type { CSSProperties } from "react";

type Props = {
  backgroundColor: string;
  borderEnabled: boolean;
  border: BorderValue;
  onBackgroundColorChange: (value: string) => void;
  onBorderEnabledChange: (value: boolean) => void;
  onBorderChange: (value: BorderValue) => void;
};

// Bare reset for a plain HTML `<fieldset>`/`<legend>` used as a section
// grouping here instead of an `Accordion` — no collapse/expand, and (like
// every `ux/` component it groups) none of the browser's own default
// border/padding chrome.
const FIELDSET_STYLE: CSSProperties = {
  border: "none",
  margin: 0,
  padding: 0,
};

const LEGEND_STYLE: CSSProperties = {
  padding: 0,
  marginBottom: "var(--mantine-spacing-xs)",
  fontSize: "var(--mantine-font-size-xs)",
  fontWeight: 600,
  color: "var(--mantine-color-dimmed)",
  textTransform: "uppercase",
};

/**
 * "Background" / "Border" sections shared between the "Up" and "Down"
 * tabs of a key's system properties — plain `<fieldset>`s (each section's
 * own `<legend>` is its only label; nothing inside ever shows one of its
 * own, matching every other `ux/` component) rather than an `Accordion`,
 * since there's nothing here worth collapsing.
 */
export default function KeyStateFields({
  backgroundColor,
  borderEnabled,
  border,
  onBackgroundColorChange,
  onBorderEnabledChange,
  onBorderChange,
}: Props) {
  return (
    <>
      <fieldset style={FIELDSET_STYLE}>
        <legend style={LEGEND_STYLE}>Background</legend>
        <Color
          aria-label="Background color"
          value={backgroundColor}
          onChange={onBackgroundColorChange}
        />
      </fieldset>
      <fieldset style={{ ...FIELDSET_STYLE, marginTop: "var(--mantine-spacing-sm)" }}>
        <legend style={LEGEND_STYLE}>Border</legend>
        <Switch
          aria-label="Border enabled"
          size="sm"
          mb="xs"
          checked={borderEnabled}
          onChange={(event) => onBorderEnabledChange(event.currentTarget.checked)}
        />
        <Border
          value={border}
          disabled={!borderEnabled}
          onChange={onBorderChange}
        />
      </fieldset>
    </>
  );
}
