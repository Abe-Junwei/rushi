/** Default loopback URL for the local ASR HTTP service (see ADR-0001). */
export const DEFAULT_ASR_BASE_URL = "http://127.0.0.1:8741";

export function asrBaseUrl(): string {
  const raw = import.meta.env.VITE_ASR_BASE_URL;
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.replace(/\/$/, "");
  }
  return DEFAULT_ASR_BASE_URL;
}

export function asrHealthUrl(base: string = asrBaseUrl()): string {
  return `${base.replace(/\/$/, "")}/health`;
}
