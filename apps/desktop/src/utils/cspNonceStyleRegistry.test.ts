import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bootstrapCspStyleNonce,
  clearAllCspScopeRulesForTests,
  flushPendingCspScopeRules,
  readCspScopeRules,
  removeCspScopeRules,
  upsertCspScopeRules,
} from "./cspNonceStyleRegistry";
import { TAURI_STYLE_CSP_NONCE_PROBE_ID } from "./tauriStyleCspNonce";

vi.mock("../config/env", () => ({
  isTauriRuntime: () => true,
}));

describe("cspNonceStyleRegistry", () => {
  beforeEach(() => {
    vi.stubEnv("PROD", true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    clearAllCspScopeRulesForTests();
    document.getElementById(TAURI_STYLE_CSP_NONCE_PROBE_ID)?.remove();
    document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.remove();
  });

  it("upserts and reads scope rules", () => {
    upsertCspScopeRules("test-scope", ".foo { color: red; }");
    expect(readCspScopeRules("test-scope")).toBe(".foo { color: red; }");
    upsertCspScopeRules("test-scope", ".foo { color: blue; }");
    expect(readCspScopeRules("test-scope")).toBe(".foo { color: blue; }");
  });

  it("removes scope rules", () => {
    upsertCspScopeRules("rm-scope", ".bar { opacity: 1; }");
    removeCspScopeRules("rm-scope");
    expect(readCspScopeRules("rm-scope")).toBeUndefined();
  });

  it("attaches nonce when probe is present", () => {
    const probe = document.createElement("style");
    probe.id = TAURI_STYLE_CSP_NONCE_PROBE_ID;
    probe.nonce = "abc123nonce";
    document.head.appendChild(probe);
    upsertCspScopeRules("nonce-scope", ".x { margin: 0; }");
    const el = document.getElementById("rushi-csp-scope-nonce-scope") as HTMLStyleElement | null;
    expect(el?.nonce).toBe("abc123nonce");
  });

  it("queues scope rules until nonce is available in Tauri runtime", () => {
    upsertCspScopeRules("pending-scope", ".pending { width: 10px; }");
    expect(document.getElementById("rushi-csp-scope-pending-scope")).toBeNull();
    expect(readCspScopeRules("pending-scope")).toBe(".pending { width: 10px; }");

    const probe = document.createElement("style");
    probe.id = TAURI_STYLE_CSP_NONCE_PROBE_ID;
    probe.nonce = "runtime-nonce";
    document.head.appendChild(probe);

    flushPendingCspScopeRules();
    const el = document.getElementById("rushi-csp-scope-pending-scope") as HTMLStyleElement | null;
    expect(el?.nonce).toBe("runtime-nonce");
    expect(el?.textContent).toBe(".pending { width: 10px; }");
  });

  it("writes scope rules without nonce in dev (Vite HTML keeps placeholder token)", () => {
    vi.stubEnv("PROD", false);
    upsertCspScopeRules("dev-scope", ".dev { color: red; }");
    const el = document.getElementById("rushi-csp-scope-dev-scope");
    expect(el?.textContent).toBe(".dev { color: red; }");
    expect(el?.nonce).toBe("");
  });

  it("bootstrap waits for nonce then flushes pending scopes", async () => {
    upsertCspScopeRules("boot-scope", ".boot { height: 1px; }");
    expect(document.getElementById("rushi-csp-scope-boot-scope")).toBeNull();

    const bootstrapPromise = bootstrapCspStyleNonce({ maxWaitMs: 500 });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const probe = document.createElement("style");
    probe.id = TAURI_STYLE_CSP_NONCE_PROBE_ID;
    probe.nonce = "boot-nonce";
    document.head.appendChild(probe);

    await expect(bootstrapPromise).resolves.toBe(true);
    const el = document.getElementById("rushi-csp-scope-boot-scope") as HTMLStyleElement | null;
    expect(el?.nonce).toBe("boot-nonce");
  });
});
