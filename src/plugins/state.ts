import { DEFAULT_STATE_NAME } from "../classes/inspectorHelpers";

export type PluginStates = Record<string, Record<string, unknown>>;

/**
 * A plugin instance's config, normalized into its `states` map — one set
 * of field values per named state (see the States menu in the Properties
 * tab, and `KeyPropertyConfig.states` for the same list at the key
 * level). A plugin instance saved before named states existed has its
 * plain fields treated as the "Up" state's own values, and an old
 * `down.config` (if it was enabled) becomes a "Down" state — the same
 * migration `resolveKeyPropertyConfig` does for the system properties.
 */
export function pluginStates(config: Record<string, unknown>): PluginStates {
  const value = config.states;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as PluginStates;
  }
  const { down, ...rest } = config;
  const states: PluginStates = { [DEFAULT_STATE_NAME]: rest };
  if (down && typeof down === "object" && !Array.isArray(down)) {
    const legacyDown = down as Record<string, unknown>;
    const enabled =
      typeof legacyDown.enabled === "boolean"
        ? legacyDown.enabled
        : legacyDown.inherited === false;
    if (
      enabled &&
      legacyDown.config &&
      typeof legacyDown.config === "object" &&
      !Array.isArray(legacyDown.config)
    ) {
      states.Down = legacyDown.config as Record<string, unknown>;
    }
  }
  return states;
}

/** `stateName`'s own field values, falling back to "Up" (or `{}`) for a
 * plugin instance that doesn't have that state yet — a state added after
 * the plugin was attached, most commonly. */
export function stateConfig(
  config: Record<string, unknown>,
  stateName: string,
): Record<string, unknown> {
  const states = pluginStates(config);
  return states[stateName] ?? states[DEFAULT_STATE_NAME] ?? {};
}

/** The full `config` to save after editing `stateName`'s own fields —
 * replaces the whole `states` map's entry for it, discarding any
 * pre-migration top-level fields the instance's `config` might still
 * carry (see `pluginStates`). */
export function withStateConfig(
  config: Record<string, unknown>,
  stateName: string,
  value: Record<string, unknown>,
): Record<string, unknown> {
  return { states: { ...pluginStates(config), [stateName]: value } };
}
