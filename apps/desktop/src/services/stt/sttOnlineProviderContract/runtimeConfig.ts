import { STT_ONLINE_PROVIDER_STORAGE_KEYS, DEFAULT_TIMEOUT_MS } from "./constants";
import { clearSttConnectionVerified, sttRuntimeConnectionFingerprint } from "./connectionVerified";
import { notifySttOnlineRuntimeChanged } from "../sttOnlineRuntimeNotify";
import { isAllowedSttOnlineEndpoint, assertValidEndpoint } from "./endpoint";
import { getSttOnlineProviderDefinition } from "./definitions";
import { sttOnlineProviderEndpointUserConfigurable } from "./presetEndpoints";
import {
  IFLYTEK_PROFILE_DEFAULT_KEY_ID,
  IFLYTEK_PROFILE_DEFAULT_SECRET_ID,
  migrateLegacySttOnlineProviderProfiles,
  readSttOnlineProviderProfileSnapshot,
  restoreSttConnectionVerifiedForProvider,
  snapshotSttOnlineProviderProfile,
  syncSttOnlineProviderProfileFromActive,
} from "./providerProfiles";
import { readStorage, writeStorage } from "./storage";
import {
  isStaleSttApiKeyIdForProvider,
  normalizeSttApiKeyId,
} from "./sttApiKeyIds";
import { normalizeXunfeiSpeedAsrAccent } from "./xunfeiAccentPresets";
import type { ExternalSttOnlineRuntimeConfig } from "./types";

/** 早期调研误纳入的短窗口厂商；读取/规范化时迁移到百炼 Fun-ASR。 */
const REMOVED_SHORT_WINDOW_STT_PROVIDER_IDS = new Set([
  "aliyun-nls",
  "tencent-asr",
  "baidu-speech",
  "iflytek-speech",
  "huawei-sis",
  "volcengine-speech",
  "aispeech",
  "google-cloud-stt",
  "azure-speech",
]);

function migrateRemovedSttProviderId(id: string): string {
  const trimmed = id.trim();
  if (REMOVED_SHORT_WINDOW_STT_PROVIDER_IDS.has(trimmed)) return "dashscope-asr";
  return trimmed;
}

export type PersistExternalSttOnlineRuntimeConfigOptions = {
  clearApiKeyId?: boolean;
  clearApiSecretId?: boolean;
};

/** 未持久化 timeout 时按厂商默认（长音频 Job 需 600s 级）。 */
export function defaultTimeoutMsForProvider(providerId: string): number {
  const def = getSttOnlineProviderDefinition(providerId);
  const ms = def?.defaultTimeoutMs;
  if (typeof ms === "number" && Number.isFinite(ms) && ms > 0) {
    return Math.max(3_000, Math.min(600_000, Math.round(ms)));
  }
  return DEFAULT_TIMEOUT_MS;
}

function normalizeTimeoutMs(raw: string | null | undefined, providerId: string): number {
  if (!raw) return defaultTimeoutMsForProvider(providerId);
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return defaultTimeoutMsForProvider(providerId);
  return Math.max(3_000, Math.min(600_000, Math.round(n)));
}

export const STT_ONLINE_TIMEOUT_SEC_MIN = 30;
export const STT_ONLINE_TIMEOUT_SEC_MAX = 600;

/** 与转写 bridge 一致：30–600 秒。 */
export function clampSttOnlineTimeoutSec(raw: number): number {
  if (!Number.isFinite(raw)) return STT_ONLINE_TIMEOUT_SEC_MIN;
  return Math.min(
    STT_ONLINE_TIMEOUT_SEC_MAX,
    Math.max(STT_ONLINE_TIMEOUT_SEC_MIN, Math.round(raw)),
  );
}

export function normalizeExternalSttOnlineRuntimeConfig(
  partial?: Partial<ExternalSttOnlineRuntimeConfig> | null,
): ExternalSttOnlineRuntimeConfig {
  const migratedId = migrateRemovedSttProviderId(partial?.selectedProviderId ?? "");
  const selected =
    migratedId && getSttOnlineProviderDefinition(migratedId) ? migratedId : "openai";
  const endpointCandidate = partial?.endpoint?.trim();
  const endpointAllowed =
    sttOnlineProviderEndpointUserConfigurable(selected) &&
    endpointCandidate &&
    isAllowedSttOnlineEndpoint(endpointCandidate);
  const endpoint = endpointAllowed ? endpointCandidate : undefined;
  const appKeyRaw = partial?.appKey?.trim();
  const appKey = appKeyRaw && appKeyRaw.length > 0 ? appKeyRaw.slice(0, 512) : undefined;
  const apiKeyId = normalizeSttApiKeyId(partial?.apiKeyId);
  const apiSecretId =
    selected === "iflytek-speed-asr" ? normalizeSttApiKeyId(partial?.apiSecretId) : undefined;
  const accentRaw = partial?.accent?.trim();
  const accent =
    selected === "iflytek-speed-asr" && accentRaw
      ? normalizeXunfeiSpeedAsrAccent(accentRaw)
      : selected === "iflytek-speed-asr"
        ? normalizeXunfeiSpeedAsrAccent(undefined)
        : undefined;
  return {
    enabled: Boolean(partial?.enabled),
    selectedProviderId: selected,
    ...(endpoint ? { endpoint } : {}),
    ...(appKey ? { appKey } : {}),
    ...(apiKeyId ? { apiKeyId } : {}),
    ...(apiSecretId ? { apiSecretId } : {}),
    ...(accent ? { accent } : {}),
    timeoutMs:
      typeof partial?.timeoutMs === "number" && Number.isFinite(partial.timeoutMs)
        ? Math.max(3_000, Math.min(600_000, Math.round(partial.timeoutMs)))
        : defaultTimeoutMsForProvider(selected),
  };
}

export function readExternalSttOnlineRuntimeConfigFromStorage(): ExternalSttOnlineRuntimeConfig {
  migrateLegacySttOnlineProviderProfiles();
  const enabledRaw = readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled);
  const rawSelected = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId) ?? "openai").trim();
  const selected = migrateRemovedSttProviderId(rawSelected);
  if (selected !== rawSelected) {
    writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId, selected);
    clearSttConnectionVerified();
  }
  const endpoint = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.endpoint) ?? "").trim();
  const appKey = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey) ?? "").trim();
  const accentStored = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.accent) ?? "").trim();
  const timeoutRaw = readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs);
  const rawApiKeyId = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId) ?? "").trim();
  let apiKeyId = normalizeSttApiKeyId(rawApiKeyId);
  if (rawApiKeyId && apiKeyId && rawApiKeyId !== apiKeyId) {
    writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId, apiKeyId);
  } else if (rawApiKeyId && !apiKeyId) {
    try {
      localStorage.removeItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId);
    } catch {
      /* ignore */
    }
    apiKeyId = undefined;
  }
  const rawApiSecretId = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiSecretId) ?? "").trim();
  let apiSecretId = normalizeSttApiKeyId(rawApiSecretId);
  if (rawApiSecretId && apiSecretId && rawApiSecretId !== apiSecretId) {
    writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiSecretId, apiSecretId);
  } else if (rawApiSecretId && !apiSecretId) {
    try {
      localStorage.removeItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiSecretId);
    } catch {
      /* ignore */
    }
    apiSecretId = undefined;
  }
  const resolvedSelected = getSttOnlineProviderDefinition(selected) ? selected : "openai";
  if (apiKeyId && isStaleSttApiKeyIdForProvider(resolvedSelected, apiKeyId)) {
    try {
      localStorage.removeItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId);
    } catch {
      /* ignore */
    }
    clearSttConnectionVerified();
    apiKeyId = undefined;
  }
  return normalizeExternalSttOnlineRuntimeConfig({
    enabled: enabledRaw === "1" || enabledRaw === "true",
    selectedProviderId: resolvedSelected,
    ...(endpoint ? { endpoint } : {}),
    ...(appKey ? { appKey } : {}),
    ...(accentStored ? { accent: accentStored } : {}),
    ...(apiKeyId ? { apiKeyId } : {}),
    ...(resolvedSelected === "iflytek-speed-asr" && apiSecretId ? { apiSecretId } : {}),
    timeoutMs: normalizeTimeoutMs(timeoutRaw, selected),
  });
}

export function resolveExternalSttOnlineRuntimeConfig(): ExternalSttOnlineRuntimeConfig {
  return normalizeExternalSttOnlineRuntimeConfig(readExternalSttOnlineRuntimeConfigFromStorage());
}

function sttPersistedConnectionFingerprint(
  config: ExternalSttOnlineRuntimeConfig,
): string {
  return sttRuntimeConnectionFingerprint({
    ...normalizeExternalSttOnlineRuntimeConfig(config),
    enabled: true,
  });
}

export function persistExternalSttOnlineRuntimeConfig(
  config: ExternalSttOnlineRuntimeConfig,
  options?: PersistExternalSttOnlineRuntimeConfigOptions,
): ExternalSttOnlineRuntimeConfig {
  assertValidEndpoint(config.endpoint);
  const previousFingerprint = sttPersistedConnectionFingerprint(readExternalSttOnlineRuntimeConfigFromStorage());
  const n = normalizeExternalSttOnlineRuntimeConfig(config);
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled, n.enabled ? "true" : "false");
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId, n.selectedProviderId);
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.endpoint, n.endpoint ?? null);
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey, n.appKey ?? null);
  if (n.selectedProviderId === "iflytek-speed-asr") {
    writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.accent, n.accent ?? normalizeXunfeiSpeedAsrAccent(undefined));
  } else {
    writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.accent, null);
  }
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs, String(n.timeoutMs));
  if (options?.clearApiKeyId) {
    try {
      localStorage.removeItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId);
    } catch {
      /* ignore */
    }
  } else if (config.apiKeyId !== undefined) {
    const normalized = normalizeSttApiKeyId(config.apiKeyId);
    if (normalized) writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId, normalized);
  }
  if (options?.clearApiSecretId) {
    try {
      localStorage.removeItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiSecretId);
    } catch {
      /* ignore */
    }
  } else if (n.selectedProviderId === "iflytek-speed-asr" && config.apiSecretId !== undefined) {
    const normalized = normalizeSttApiKeyId(config.apiSecretId);
    if (normalized) writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiSecretId, normalized);
  } else if (n.selectedProviderId !== "iflytek-speed-asr") {
    try {
      localStorage.removeItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiSecretId);
    } catch {
      /* ignore */
    }
  }
  if (previousFingerprint !== sttPersistedConnectionFingerprint(n)) {
    clearSttConnectionVerified();
  } else {
    notifySttOnlineRuntimeChanged();
  }
  syncSttOnlineProviderProfileFromActive(n);
  return n;
}

function profileSnapshotToRuntimeConfig(providerId: string): ExternalSttOnlineRuntimeConfig {
  const snapshot = readSttOnlineProviderProfileSnapshot(providerId);
  let apiKeyId = normalizeSttApiKeyId(snapshot?.apiKeyId);
  if (apiKeyId && isStaleSttApiKeyIdForProvider(providerId, apiKeyId)) {
    apiKeyId = undefined;
  }
  if (!apiKeyId && providerId === "iflytek-speed-asr" && snapshot) {
    apiKeyId = normalizeSttApiKeyId(IFLYTEK_PROFILE_DEFAULT_KEY_ID);
  }
  let apiSecretId =
    providerId === "iflytek-speed-asr"
      ? normalizeSttApiKeyId(snapshot?.apiSecretId)
      : undefined;
  if (apiSecretId && isStaleSttApiKeyIdForProvider(providerId, apiSecretId)) {
    apiSecretId = undefined;
  }
  if (!apiSecretId && providerId === "iflytek-speed-asr" && snapshot) {
    apiSecretId = normalizeSttApiKeyId(IFLYTEK_PROFILE_DEFAULT_SECRET_ID);
  }
  return normalizeExternalSttOnlineRuntimeConfig({
    enabled: true,
    selectedProviderId: providerId,
    timeoutMs: snapshot?.timeoutMs ?? defaultTimeoutMsForProvider(providerId),
    ...(snapshot?.endpoint ? { endpoint: snapshot.endpoint } : {}),
    ...(snapshot?.appKey ? { appKey: snapshot.appKey } : {}),
    ...(snapshot?.accent ? { accent: snapshot.accent } : {}),
    ...(apiKeyId ? { apiKeyId } : {}),
    ...(apiSecretId ? { apiSecretId } : {}),
  });
}

/**
 * 切换在线 STT 厂商：快照离开方草稿，激活目标方 profile 并写回 flat storage。
 */
export function switchSttOnlineProviderActive(
  fromProviderId: string,
  toProviderId: string,
  outgoingDraft: ExternalSttOnlineRuntimeConfig,
): ExternalSttOnlineRuntimeConfig {
  migrateLegacySttOnlineProviderProfiles();
  snapshotSttOnlineProviderProfile(fromProviderId, outgoingDraft);
  const incoming = profileSnapshotToRuntimeConfig(toProviderId);
  persistExternalSttOnlineRuntimeConfig(incoming);
  restoreSttConnectionVerifiedForProvider(toProviderId, incoming);
  return incoming;
}


