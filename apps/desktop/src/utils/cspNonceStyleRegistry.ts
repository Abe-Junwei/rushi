import { isTauriRuntime } from "../config/env";
import { readTauriStyleCspNonce } from "./tauriStyleCspNonce";

const SCOPE_STYLE_ID_PREFIX = "rushi-csp-scope-";

/** Scope rules queued until Tauri style CSP nonce is available (Release CSP blocks nonce-less `<style>`). */
const pendingScopes = new Map<string, string>();

function scopeStyleElementId(scopeId: string): string {
  return `${SCOPE_STYLE_ID_PREFIX}${scopeId}`;
}

function requiresStyleNonce(): boolean {
  return isTauriRuntime();
}

function writeScopeStyleElement(scopeId: string, cssText: string): void {
  if (typeof document === "undefined") return;

  const elementId = scopeStyleElementId(scopeId);
  const nonce = readTauriStyleCspNonce();

  if (requiresStyleNonce() && !nonce) {
    pendingScopes.set(scopeId, cssText);
    return;
  }

  pendingScopes.delete(scopeId);

  let el = document.getElementById(elementId) as HTMLStyleElement | null;
  const hadMissingNonce = Boolean(el && nonce && !(el as HTMLElement).nonce && !el.getAttribute("nonce"));

  if (!el || hadMissingNonce) {
    el?.remove();
    el = document.createElement("style");
    el.id = elementId;
    document.head.appendChild(el);
  }

  if (nonce && (el as HTMLElement).nonce !== nonce) {
    el.nonce = nonce;
  }

  if (el.textContent !== cssText) {
    el.textContent = cssText;
  }
}

/** Upsert nonce-backed `<style>` rules for a logical scope (CSP style-src, not style-src-attr). */
export function upsertCspScopeRules(scopeId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  const trimmed = cssText.trim();
  if (!trimmed) {
    pendingScopes.delete(scopeId);
    removeCspScopeRules(scopeId);
    return;
  }
  writeScopeStyleElement(scopeId, trimmed);
}

export function removeCspScopeRules(scopeId: string): void {
  if (typeof document === "undefined") return;
  pendingScopes.delete(scopeId);
  document.getElementById(scopeStyleElementId(scopeId))?.remove();
}

export function readCspScopeRules(scopeId: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const applied = document.getElementById(scopeStyleElementId(scopeId))?.textContent ?? undefined;
  if (applied) return applied;
  return pendingScopes.get(scopeId);
}

/** Apply queued scope rules once Tauri nonce is readable; also repairs head scopes missing nonce. */
export function flushPendingCspScopeRules(): void {
  if (typeof document === "undefined") return;
  const nonce = readTauriStyleCspNonce();
  if (requiresStyleNonce() && !nonce) return;

  for (const [scopeId, cssText] of [...pendingScopes.entries()]) {
    writeScopeStyleElement(scopeId, cssText);
  }

  if (!nonce) return;

  for (const el of document.head.querySelectorAll<HTMLStyleElement>(
    `style[id^="${SCOPE_STYLE_ID_PREFIX}"]`,
  )) {
    if ((el as HTMLElement).nonce === nonce) continue;
    const cssText = el.textContent ?? "";
    if (!cssText.trim()) continue;
    const scopeId = el.id.slice(SCOPE_STYLE_ID_PREFIX.length);
    el.remove();
    writeScopeStyleElement(scopeId, cssText.trim());
  }
}

function scheduleLateNonceFlush(maxWaitMs = 10_000): void {
  if (typeof document === "undefined" || !requiresStyleNonce()) return;
  const start = performance.now();
  const tick = (): void => {
    if (readTauriStyleCspNonce()) {
      flushPendingCspScopeRules();
      return;
    }
    if (performance.now() - start > maxWaitMs) return;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Wait for Tauri HTML nonce injection before React mounts dynamic layout `<style>` scopes. */
export async function bootstrapCspStyleNonce(options?: { maxWaitMs?: number }): Promise<boolean> {
  if (typeof document === "undefined") return true;
  if (!requiresStyleNonce()) {
    flushPendingCspScopeRules();
    return true;
  }

  const maxWaitMs = options?.maxWaitMs ?? 3_000;
  const start = performance.now();
  while (!readTauriStyleCspNonce()) {
    if (performance.now() - start > maxWaitMs) {
      console.warn("[csp] style nonce unavailable after bootstrap wait; layout fallbacks may apply");
      scheduleLateNonceFlush();
      return false;
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  flushPendingCspScopeRules();
  return true;
}

/** Test-only: clear all registry scopes from document.head. */
export function clearAllCspScopeRulesForTests(): void {
  if (typeof document === "undefined") return;
  pendingScopes.clear();
  for (const el of [...document.head.querySelectorAll(`style[id^="${SCOPE_STYLE_ID_PREFIX}"]`)]) {
    el.remove();
  }
}
