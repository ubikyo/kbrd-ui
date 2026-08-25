export type PluginDownState = {
  inherited: boolean;
  delay: number;
  config?: Record<string, unknown>;
};

export function upConfig(config: Record<string, unknown>) {
  const up = { ...config };
  delete up.down;
  return up;
}

export function downState(config: Record<string, unknown>): PluginDownState {
  const value = config.down;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { inherited: true, delay: 0 };
  }
  const down = value as Record<string, unknown>;
  return {
    inherited: down.inherited !== false,
    delay:
      typeof down.delay === "number" && Number.isFinite(down.delay)
        ? Math.max(0, down.delay)
        : 0,
    config:
      down.config &&
      typeof down.config === "object" &&
      !Array.isArray(down.config)
        ? (down.config as Record<string, unknown>)
        : undefined,
  };
}

export function effectiveConfig(
  config: Record<string, unknown>,
  useDown: boolean,
) {
  const up = upConfig(config);
  if (!useDown) return up;
  const down = downState(config);
  return down.inherited ? up : (down.config ?? up);
}
