import { ColorInput, NumberInput, Stack, Switch } from "@mantine/core";
import { PropertyRow } from "@kbrd/plugins/web";

import { COLOR_SWATCHES, isHexColor } from "../classes/inspectorHelpers";

type Props = {
  backgroundColor: string;
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number;
  onBackgroundColorChange: (value: string) => void;
  onBorderEnabledChange: (value: boolean) => void;
  onBorderColorChange: (value: string) => void;
  onBorderWidthChange: (value: number) => void;
};

/**
 * Champs "Background color / Border / Border color / Border size" partagés
 * entre les onglets "Up" et "Down" des propriétés système d'une touche.
 */
export default function KeyStateFields({
  backgroundColor,
  borderEnabled,
  borderColor,
  borderWidth,
  onBackgroundColorChange,
  onBorderEnabledChange,
  onBorderColorChange,
  onBorderWidthChange,
}: Props) {
  return (
    <Stack gap="sm">
      <PropertyRow label="Background color">
        <ColorInput
          w="100%"
          aria-label="Background color"
          size="xs"
          format="hexa"
          value={backgroundColor}
          swatches={COLOR_SWATCHES}
          error={isHexColor(backgroundColor, true) ? undefined : "Invalid color"}
          success={isHexColor(backgroundColor, true)}
          onChange={onBackgroundColorChange}
        />
      </PropertyRow>
      <PropertyRow label="Border" align="center" compactControl>
        <Switch
          aria-label="Border"
          size="sm"
          checked={borderEnabled}
          onChange={(event) =>
            onBorderEnabledChange(event.currentTarget.checked)
          }
        />
      </PropertyRow>
      <PropertyRow label="Border color">
        <ColorInput
          w="100%"
          aria-label="Border color"
          size="xs"
          format="hex"
          value={borderColor}
          disabled={!borderEnabled}
          swatches={COLOR_SWATCHES}
          error={isHexColor(borderColor) ? undefined : "Invalid color"}
          success={isHexColor(borderColor)}
          onChange={onBorderColorChange}
        />
      </PropertyRow>
      <PropertyRow label="Border size">
        <NumberInput
          w="100%"
          aria-label="Border size"
          size="xs"
          min={1}
          max={4}
          allowDecimal={false}
          clampBehavior="strict"
          value={borderWidth}
          disabled={!borderEnabled}
          success
          onChange={(value) =>
            onBorderWidthChange(typeof value === "number" ? value : 1)
          }
        />
      </PropertyRow>
    </Stack>
  );
}
