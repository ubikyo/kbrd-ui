import type { KeyPropertyConfig } from "../types/workspace";

type LegacyKeyPropertyConfig = Partial<KeyPropertyConfig> & {
  borderEnabled?: boolean;
  borderWidth?: number;
};

/**
 * Résout le drapeau "bordure activée" pour un état (up/down) donné, avec
 * repli sur l'ancien champ unique `borderEnabled` pour les workspaces
 * enregistrés avant l'introduction des états up/down distincts.
 */
export function resolveBorderEnabled(
  config: LegacyKeyPropertyConfig | undefined,
  down: boolean,
): boolean {
  const legacy = config?.borderEnabled ?? true;
  return down
    ? (config?.downBorderEnabled ?? legacy)
    : (config?.upBorderEnabled ?? legacy);
}

/**
 * Résout la largeur de bordure pour un état (up/down) donné, avec le même
 * repli vers l'ancien champ unique `borderWidth`.
 */
export function resolveBorderWidth(
  config: LegacyKeyPropertyConfig | undefined,
  down: boolean,
): number {
  const legacy = config?.borderWidth;
  return down
    ? (config?.downBorderWidth ?? legacy ?? 1)
    : (config?.upBorderWidth ?? legacy ?? 1);
}
