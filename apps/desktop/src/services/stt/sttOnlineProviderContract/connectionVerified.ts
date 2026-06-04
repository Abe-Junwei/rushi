import { STT_ONLINE_PROVIDER_STORAGE_KEYS } from "./constants";
import { readStorage, writeStorage } from "./storage";
import type { ExternalSttOnlineRuntimeConfig } from "./types";

export const STT_CONNECTION_VERIFIED_EVENT = "rushi:stt-connection-verified";

export function sttRuntimeConnectionFingerprint(
  config: Pick<
    ExternalSttOnlineRuntimeConfig,
    "enabled" | "selectedProviderId" | "endpoint" | "appKey" | "timeoutMs"
  >,
): string {
  return [
    config.enabled ? "1" : "0",
    config.selectedProviderId,
    config.endpoint ?? "",
    config.appKey ?? "",
    String(config.timeoutMs),
  ].join("\0");
}

export function markSttConnectionVerified(config: ExternalSttOnlineRuntimeConfig): void {
  writeStorage(
    STT_ONLINE_PROVIDER_STORAGE_KEYS.connectionVerifiedFingerprint,
    sttRuntimeConnectionFingerprint(config),
  );
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(STT_CONNECTION_VERIFIED_EVENT));
  }
}

export function clearSttConnectionVerified(): void {
  try {
    if ("localStorage" in globalThis && globalThis.localStorage) {
      globalThis.localStorage.removeItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.connectionVerifiedFingerprint);
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(STT_CONNECTION_VERIFIED_EVENT));
  }
}

export function isSttConnectionVerified(
  config: Pick<
    ExternalSttOnlineRuntimeConfig,
    "enabled" | "selectedProviderId" | "endpoint" | "appKey" | "timeoutMs"
  >,
): boolean {
  const stored = readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.connectionVerifiedFingerprint);
  if (!stored) return false;
  return stored === sttRuntimeConnectionFingerprint(config);
}
