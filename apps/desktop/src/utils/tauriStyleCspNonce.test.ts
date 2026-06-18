import { describe, expect, it, afterEach, vi } from "vitest";
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
    probe.nonce = "1234567890";
    document.head.appendChild(probe);
    expect(readTauriStyleCspNonce()).toBe("1234567890");
  });

  it("reads nonce via IDL when getAttribute is hidden (CSP nonce hiding)", () => {
    const probe = document.createElement("style");
    probe.id = TAURI_STYLE_CSP_NONCE_PROBE_ID;
    probe.nonce = "hidden-runtime-nonce";
    document.head.appendChild(probe);
    const getAttribute = probe.getAttribute.bind(probe);
    vi.spyOn(probe, "getAttribute").mockImplementation((name) =>
      name === "nonce" ? "" : getAttribute(name),
    );
    expect(readTauriStyleCspNonce()).toBe("hidden-runtime-nonce");
  });

  it("falls back to any head style nonce when probe is absent", () => {
    const style = document.createElement("style");
    style.nonce = "9876543210";
    document.head.appendChild(style);
    expect(readTauriStyleCspNonce()).toBe("9876543210");
    style.remove();
  });

  it("reads nonce from CSP meta content", () => {
    const meta = document.createElement("meta");
    meta.setAttribute("http-equiv", "Content-Security-Policy");
    meta.setAttribute(
      "content",
      "default-src 'self'; style-src 'self' 'nonce-meta-nonce-42'",
    );
    document.head.appendChild(meta);
    expect(readTauriStyleCspNonce()).toBe("meta-nonce-42");
  });
});
