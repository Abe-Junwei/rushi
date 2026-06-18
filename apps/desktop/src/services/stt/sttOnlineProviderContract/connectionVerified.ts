import { STT_ONLINE_PROVIDER_STORAGE_KEYS } from "./constants";
import { readStorage, writeStorage } from "./storage";
import { notifySttOnlineRuntimeChanged } from "../sttOnlineRuntimeNotify";
import { getSttOnlineProviderDefinition } from "./definitions";
import { hasSttOnlineApiSecretReference } from "./apiSecretStorage";
import type { ExternalSttOnlineRuntimeConfig } from "./types";

export const STT_CONNECTION_VERIFIED_EVENT = "rushi:stt-connection-verified";

export function sttRuntimeConnectionFingerprint(
  config: Pick<
    ExternalSttOnlineRuntimeConfig,
    "enabled" | "selectedProviderId" | "endpoint" | "appKey" | "apiKeyId" | "apiSecretId" | "accent" | "timeoutMs"
  >,
): string {
  return [
    config.enabled ? "1" : "0",
    config.selectedProviderId,
    config.endpoint ?? "",
    config.appKey ?? "",
    config.apiKeyId ?? "",
    config.apiSecretId ?? "",
    config.accent ?? "",
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
  notifySttOnlineRuntimeChanged();
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
  notifySttOnlineRuntimeChanged();
}

export function isSttConnectionVerified(
  config: Pick<
    ExternalSttOnlineRuntimeConfig,
    "enabled" | "selectedProviderId" | "endpoint" | "appKey" | "apiKeyId" | "apiSecretId" | "accent" | "timeoutMs"
  >,
): boolean {
  const stored = readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.connectionVerifiedFingerprint);
  if (!stored) return false;
  if (stored !== sttRuntimeConnectionFingerprint(config)) return false;
  const def = getSttOnlineProviderDefinition(config.selectedProviderId);
  if (def?.requiresApiSecret && !hasSttOnlineApiSecretReference()) {
    return false;
  }
  return true;
}
