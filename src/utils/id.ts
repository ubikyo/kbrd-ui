// `crypto.randomUUID()` only exists in a "secure context" (HTTPS, or the
// `localhost` exemption) — this app is often reached over plain HTTP via
// a LAN IP instead (developing inside a VM whose browser is on the host —
// see the project's own notes on that), where it's simply `undefined`,
// throwing "crypto.randomUUID is not a function" the moment anything
// tries to mint a fresh `keyRef`. None of this app's own uses need actual
// cryptographic randomness — just a locally-unique identifier — so this
// falls back to a plain `Math.random()`-based v4 UUID instead of
// requiring a secure context at all.
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
