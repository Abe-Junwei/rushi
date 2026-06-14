/**
 * Default loopback URL for the local ASR HTTP service (see ADR-0001).
 * TCP from the desktop shell uses 127.0.0.1 via loopback proxy (rushi-asr binds IPv4 loopback only).
 */
const DEFAULT_ASR_BASE_URL = "http://127.0.0.1:8741";

function trimTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

export function asrBaseUrl(): string {
  const raw = import.meta.env.VITE_ASR_BASE_URL;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const t = raw.trim();
    try {
      const u = new URL(t);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return DEFAULT_ASR_BASE_URL;
      }
      return trimTrailingSlashes(u.toString());
    } catch {
      return DEFAULT_ASR_BASE_URL;
    }
  }
  return DEFAULT_ASR_BASE_URL;
}

export function asrHealthUrl(base: string = asrBaseUrl()): string {
  return `${trimTrailingSlashes(base)}/health`;
}

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return typeof w.__TAURI__ !== "undefined" || typeof w.__TAURI_INTERNALS__ !== "undefined";
}

/** Tauri release bundle (not `tauri dev` + Vite dev server). Legacy — prefer `readShellManagesBundledSidecarSync()`. */
export function isPackagedDesktopApp(): boolean {
  return import.meta.env.PROD && isTauriRuntime();
}

/** True when UI targets the default loopback ASR (same as bundled sidecar). */
export function isDefaultBundledAsrTarget(): boolean {
  return asrBaseUrl() === DEFAULT_ASR_BASE_URL;
}
