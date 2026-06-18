import { readTauriStyleCspNonce } from "./tauriStyleCspNonce";

const SCOPE_STYLE_ID_PREFIX = "rushi-csp-scope-";

function scopeStyleElementId(scopeId: string): string {
  return `${SCOPE_STYLE_ID_PREFIX}${scopeId}`;
}

/** Upsert nonce-backed `<style>` rules for a logical scope (CSP style-src, not style-src-attr). */
export function upsertCspScopeRules(scopeId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  const trimmed = cssText.trim();
  const elementId = scopeStyleElementId(scopeId);
  if (!trimmed) {
    removeCspScopeRules(scopeId);
    return;
  }
  let el = document.getElementById(elementId) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = elementId;
    const nonce = readTauriStyleCspNonce();
    if (nonce) el.setAttribute("nonce", nonce);
    document.head.appendChild(el);
  } else if (!el.getAttribute("nonce")) {
    const nonce = readTauriStyleCspNonce();
    if (nonce) el.setAttribute("nonce", nonce);
  }
  if (el.textContent !== trimmed) el.textContent = trimmed;
}

export function removeCspScopeRules(scopeId: string): void {
  if (typeof document === "undefined") return;
  document.getElementById(scopeStyleElementId(scopeId))?.remove();
}

export function readCspScopeRules(scopeId: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.getElementById(scopeStyleElementId(scopeId))?.textContent ?? undefined;
}

/** Test-only: clear all registry scopes from document.head. */
export function clearAllCspScopeRulesForTests(): void {
  if (typeof document === "undefined") return;
  for (const el of [...document.head.querySelectorAll(`style[id^="${SCOPE_STYLE_ID_PREFIX}"]`)]) {
    el.remove();
  }
}
