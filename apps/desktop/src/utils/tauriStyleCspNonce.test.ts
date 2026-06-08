import { describe, expect, it, afterEach } from "vitest";
import {
  readTauriStyleCspNonce,
  TAURI_STYLE_CSP_NONCE_PROBE_ID,
  TAURI_STYLE_NONCE_TOKEN,
} from "./tauriStyleCspNonce";

describe("readTauriStyleCspNonce", () => {
  afterEach(() => {
    document.getElementById(TAURI_STYLE_CSP_NONCE_PROBE_ID)?.remove();
  });

  it("returns undefined when probe is missing", () => {
    expect(readTauriStyleCspNonce()).toBeUndefined();
  });

  it("returns undefined when nonce is still the compile-time token", () => {
    const probe = document.createElement("style");
    probe.id = TAURI_STYLE_CSP_NONCE_PROBE_ID;
    probe.setAttribute("nonce", TAURI_STYLE_NONCE_TOKEN);
    document.head.appendChild(probe);
    expect(readTauriStyleCspNonce()).toBeUndefined();
  });

  it("returns runtime nonce when Tauri replaced the token", () => {
    const probe = document.createElement("style");
    probe.id = TAURI_STYLE_CSP_NONCE_PROBE_ID;
    probe.setAttribute("nonce", "1234567890");
    document.head.appendChild(probe);
    expect(readTauriStyleCspNonce()).toBe("1234567890");
  });

  it("falls back to any head style nonce when probe is absent", () => {
    const style = document.createElement("style");
    style.setAttribute("nonce", "9876543210");
    document.head.appendChild(style);
    expect(readTauriStyleCspNonce()).toBe("9876543210");
    style.remove();
  });
});
