import { STT_ONLINE_PROVIDER_STORAGE_KEYS, DEFAULT_TIMEOUT_MS } from "./constants";
import { isAllowedSttOnlineEndpoint, assertValidEndpoint } from "./endpoint";
import { getSttOnlineProviderDefinition } from "./definitions";
import { readStorage, writeStorage } from "./storage";
import type { ExternalSttOnlineRuntimeConfig } from "./types";

function normalizeTimeoutMs(raw: string | null | undefined): number {
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.max(3_000, Math.min(600_000, Math.round(n)));
}

export function normalizeExternalSttOnlineRuntimeConfig(
  partial?: Partial<ExternalSttOnlineRuntimeConfig> | null,
): ExternalSttOnlineRuntimeConfig {
  const selected =
    partial?.selectedProviderId?.trim() && getSttOnlineProviderDefinition(partial.selectedProviderId.trim())
      ? partial.selectedProviderId.trim()
      : "openai";
  const endpointCandidate = partial?.endpoint?.trim();
  const endpoint =
    endpointCandidate && isAllowedSttOnlineEndpoint(endpointCandidate) ? endpointCandidate : undefined;
  const appKeyRaw = partial?.appKey?.trim();
  const appKey = appKeyRaw && appKeyRaw.length > 0 ? appKeyRaw.slice(0, 512) : undefined;
  return {
    enabled: Boolean(partial?.enabled),
    selectedProviderId: selected,
    ...(endpoint ? { endpoint } : {}),
    ...(appKey ? { appKey } : {}),
    timeoutMs:
      typeof partial?.timeoutMs === "number" && Number.isFinite(partial.timeoutMs)
        ? Math.max(3_000, Math.min(600_000, Math.round(partial.timeoutMs)))
        : normalizeTimeoutMs(undefined),
  };
}

export function readExternalSttOnlineRuntimeConfigFromStorage(): ExternalSttOnlineRuntimeConfig {
  const enabledRaw = readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled);
  const selected = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId) ?? "openai").trim();
  const endpoint = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.endpoint) ?? "").trim();
  const appKey = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey) ?? "").trim();
  const timeoutRaw = readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs);
  return normalizeExternalSttOnlineRuntimeConfig({
    enabled: enabledRaw === "1" || enabledRaw === "true",
    selectedProviderId: getSttOnlineProviderDefinition(selected) ? selected : "openai",
    ...(endpoint ? { endpoint } : {}),
    ...(appKey ? { appKey } : {}),
    timeoutMs: normalizeTimeoutMs(timeoutRaw),
  });
}

export function resolveExternalSttOnlineRuntimeConfig(): ExternalSttOnlineRuntimeConfig {
  return normalizeExternalSttOnlineRuntimeConfig(readExternalSttOnlineRuntimeConfigFromStorage());
}

export function persistExternalSttOnlineRuntimeConfig(
  config: ExternalSttOnlineRuntimeConfig,
): ExternalSttOnlineRuntimeConfig {
  assertValidEndpoint(config.endpoint);
  const n = normalizeExternalSttOnlineRuntimeConfig(config);
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled, n.enabled ? "true" : "false");
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId, n.selectedProviderId);
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.endpoint, n.endpoint ?? null);
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey, n.appKey ?? null);
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs, String(n.timeoutMs));
  return n;
}


