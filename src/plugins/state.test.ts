import { describe, expect, it } from "vitest";

import { downState, effectiveConfig, upConfig } from "./state";

describe("plugin states", () => {
  const config = {
    text: "Up",
    down: {
      enabled: true,
      delay: 125,
      config: { text: "Down" },
    },
  };

  it("separates the Up and Down configurations", () => {
    expect(upConfig(config)).toEqual({ text: "Up" });
    expect(downState(config)).toEqual(config.down);
    expect(effectiveConfig(config, false)).toEqual({ text: "Up" });
    expect(effectiveConfig(config, true)).toEqual({ text: "Down" });
  });

  it("uses Up when Down is disabled", () => {
    const disabled = {
      text: "Up",
      down: { enabled: false, delay: 0, config: { text: "Ignored" } },
    };
    expect(effectiveConfig(disabled, true)).toEqual({ text: "Up" });
  });

  it("defaults legacy configurations to disabled Down", () => {
    expect(downState({ text: "Legacy" })).toEqual({
      enabled: false,
      delay: 0,
    });
  });
});
