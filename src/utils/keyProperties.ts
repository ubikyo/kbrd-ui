import {
  DEFAULT_KEY_PROPERTIES,
  DEFAULT_STATE_CONFIG,
  DEFAULT_STATE_NAME,
} from "../classes/inspectorHelpers";
import type { KeyMode, KeyPropertyConfig, KeyStateConfig } from "../types/layer";

// The shape `KeyPropertyConfig` had before named states existed: a single
// `up*`/`down*` pair (plus an even older single-field `borderEnabled`/
// `borderWidth`, from before Up/Down were split at all) instead of
// `states`/`stateConfigs`.
type LegacyKeyPropertyConfig = {
  keyMode?: KeyMode;
  borderEnabled?: boolean;
  borderWidth?: number;
  downEnabled?: boolean;
  upBorderEnabled?: boolean;
  downBorderEnabled?: boolean;
  upBorderColor?: string;
  downBorderColor?: string;
  upBorderWidth?: number;
  downBorderWidth?: number;
  upBackgroundColor?: string;
  downBackgroundColor?: string;
};

/**
 * Normalizes a key's saved Properties config into the current
 * `states`/`stateConfigs` shape, migrating a layer saved before named
 * states existed: its `up*` fields become the "Up" state, and its
 * `down*` fields become a "Down" state — but only when `downEnabled` was
 * actually set, since a key that never turned Down on shouldn't gain an
 * extra state just from being read once under the new model.
 */
export function resolveKeyPropertyConfig(
  config: Partial<KeyPropertyConfig> | LegacyKeyPropertyConfig | undefined,
): KeyPropertyConfig {
  if (!config) return DEFAULT_KEY_PROPERTIES;
  const current = config as Partial<KeyPropertyConfig>;
  if (Array.isArray(current.states) && current.states.length > 0) {
    const states = current.states;
    return {
      keyMode: current.keyMode ?? DEFAULT_KEY_PROPERTIES.keyMode,
      states,
      stateConfigs: states.reduce<Record<string, KeyStateConfig>>(
        (acc, state) => {
          acc[state] = {
            ...DEFAULT_STATE_CONFIG,
            ...current.stateConfigs?.[state],
          };
          return acc;
        },
        {},
      ),
    };
  }

  const legacy = config as LegacyKeyPropertyConfig;
  const upState: KeyStateConfig = {
    backgroundColor: legacy.upBackgroundColor ?? DEFAULT_STATE_CONFIG.backgroundColor,
    borderEnabled: legacy.upBorderEnabled ?? legacy.borderEnabled ?? true,
    borderColor: legacy.upBorderColor ?? DEFAULT_STATE_CONFIG.borderColor,
    borderWidth: legacy.upBorderWidth ?? legacy.borderWidth ?? 1,
  };
  const states = [DEFAULT_STATE_NAME];
  const stateConfigs: Record<string, KeyStateConfig> = {
    [DEFAULT_STATE_NAME]: upState,
  };
  if (legacy.downEnabled) {
    states.push("Down");
    stateConfigs.Down = {
      backgroundColor: legacy.downBackgroundColor ?? DEFAULT_STATE_CONFIG.backgroundColor,
      borderEnabled: legacy.downBorderEnabled ?? true,
      borderColor: legacy.downBorderColor ?? DEFAULT_STATE_CONFIG.borderColor,
      borderWidth: legacy.downBorderWidth ?? 1,
    };
  }
  return { keyMode: legacy.keyMode ?? DEFAULT_KEY_PROPERTIES.keyMode, states, stateConfigs };
}
