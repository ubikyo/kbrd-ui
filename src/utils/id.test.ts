import { afterEach, describe, expect, it, vi } from "vitest";

import { randomId } from "./id";

describe("randomId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses crypto.randomUUID() when available", () => {
    const uuid = "11111111-1111-4111-8111-111111111111";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(uuid);
    expect(randomId()).toBe(uuid);
  });

  // `crypto.randomUUID` only exists in a secure context (HTTPS, or the
  // `localhost` exemption) — this app is often reached over plain HTTP
  // via a LAN IP instead, where the method is simply absent.
  it("falls back to a Math.random()-based v4 UUID when crypto.randomUUID is unavailable", () => {
    const original = crypto.randomUUID;
    // @ts-expect-error -- simulating an insecure context, where this
    // method doesn't exist at all rather than throwing when called.
    delete crypto.randomUUID;
    try {
      const id = randomId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(randomId()).not.toBe(id);
    } finally {
      crypto.randomUUID = original;
    }
  });
});
