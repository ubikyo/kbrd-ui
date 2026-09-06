import { describe, expect, it } from "vitest";

import { pluginStates, stateConfig, withStateConfig } from "./state";

describe("plugin states", () => {
  it("reads an already-migrated states map as-is", () => {
    const config = { states: { Up: { text: "Up" }, Down: { text: "Down" } } };
    expect(pluginStates(config)).toEqual({
      Up: { text: "Up" },
      Down: { text: "Down" },
    });
    expect(stateConfig(config, "Up")).toEqual({ text: "Up" });
    expect(stateConfig(config, "Down")).toEqual({ text: "Down" });
  });

  it("falls back to Up for a state the plugin doesn't have yet", () => {
    const config = { states: { Up: { text: "Up" } } };
    expect(stateConfig(config, "Hover")).toEqual({ text: "Up" });
  });

  it("migrates a legacy plain config into an Up state", () => {
    const config = { text: "Legacy" };
    expect(pluginStates(config)).toEqual({ Up: { text: "Legacy" } });
    expect(stateConfig(config, "Up")).toEqual({ text: "Legacy" });
  });

  it("migrates a legacy enabled Down override into a Down state", () => {
    const config = {
      text: "Up",
      down: { enabled: true, delay: 125, config: { text: "Down" } },
    };
    expect(pluginStates(config)).toEqual({
      Up: { text: "Up" },
      Down: { text: "Down" },
    });
  });

  it("ignores a legacy Down override that was never enabled", () => {
    const config = {
      text: "Up",
      down: { enabled: false, delay: 0, config: { text: "Ignored" } },
    };
    expect(pluginStates(config)).toEqual({ Up: { text: "Up" } });
  });

  it("writes back only the edited state, discarding legacy top-level fields", () => {
    const config = { text: "Legacy", down: { enabled: false, delay: 0 } };
    expect(withStateConfig(config, "Up", { text: "New" })).toEqual({
      states: { Up: { text: "New" } },
    });
  });
});
