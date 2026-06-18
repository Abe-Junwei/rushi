import { describe, expect, it, afterEach } from "vitest";
import {
  clearAllCspScopeRulesForTests,
  readCspScopeRules,
  removeCspScopeRules,
  upsertCspScopeRules,
} from "./cspNonceStyleRegistry";
import { TAURI_STYLE_CSP_NONCE_PROBE_ID } from "./tauriStyleCspNonce";

describe("cspNonceStyleRegistry", () => {
  afterEach(() => {
    clearAllCspScopeRulesForTests();
    document.getElementById(TAURI_STYLE_CSP_NONCE_PROBE_ID)?.remove();
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
    probe.setAttribute("nonce", "abc123nonce");
    document.head.appendChild(probe);
    upsertCspScopeRules("nonce-scope", ".x { margin: 0; }");
    const el = document.getElementById("rushi-csp-scope-nonce-scope");
    expect(el?.getAttribute("nonce")).toBe("abc123nonce");
  });
});
