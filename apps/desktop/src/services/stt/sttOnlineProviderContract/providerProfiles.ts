import { STT_ONLINE_PROVIDER_STORAGE_KEYS } from "./constants";
import { sttRuntimeConnectionFingerprint } from "./connectionVerified";
import { getSttOnlineProviderDefinition } from "./definitions";
import { readStorage, writeStorage } from "./storage";
import {
  IFLYTEK_STT_API_KEY_ID,
  IFLYTEK_STT_API_SECRET_ID,
  normalizeSttApiKeyId,
} from "./sttApiKeyIds";
import type { ExternalSttOnlineRuntimeConfig } from "./types";

/** 单个在线 STT 厂商的非密钥持久化快照（apiKeyId 仅为钥匙串引用名）。 */
export type SttOnlineProviderProfileSnapshot = {
  endpoint?: string;
  appKey?: string;
  apiKeyId?: string;
  apiSecretId?: string;
  accent?: string;
  timeoutMs?: number;
  connectionVerifiedFingerprint?: string;
};

type SttOnlineProviderProfileMap = Record<string, SttOnlineProviderProfileSnapshot>;

function readProviderProfileMapRaw(): SttOnlineProviderProfileMap {
  const raw = readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.providerProfiles);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as SttOnlineProviderProfileMap;
  } catch {
    return {};
  }
}

function writeProviderProfileMap(map: SttOnlineProviderProfileMap): void {
  writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.providerProfiles, JSON.stringify(map));
}

function readFlatActiveSnapshotForMigration(): SttOnlineProviderProfileSnapshot | null {
  const selected = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId) ?? "").trim();
  if (!selected || !getSttOnlineProviderDefinition(selected)) return null;
  const endpoint = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.endpoint) ?? "").trim();
  const appKey = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey) ?? "").trim();
  const accent = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.accent) ?? "").trim();
  const timeoutRaw = readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs);
  const apiKeyId = normalizeSttApiKeyId(readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId));
  const apiSecretId = normalizeSttApiKeyId(readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiSecretId));
  const verified = readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.connectionVerifiedFingerprint)?.trim();
  const timeoutMs = timeoutRaw ? Number(timeoutRaw) : undefined;
  const hasData =
    Boolean(endpoint || appKey || accent || apiKeyId || apiSecretId || verified) ||
    (typeof timeoutMs === "number" && Number.isFinite(timeoutMs));
  if (!hasData) return null;
  return {
    ...(endpoint ? { endpoint } : {}),
    ...(appKey ? { appKey } : {}),
    ...(accent ? { accent } : {}),
    ...(apiKeyId ? { apiKeyId } : {}),
    ...(selected === "iflytek-speed-asr" && apiSecretId ? { apiSecretId } : {}),
    ...(typeof timeoutMs === "number" && Number.isFinite(timeoutMs) ? { timeoutMs } : {}),
    ...(verified ? { connectionVerifiedFingerprint: verified } : {}),
  };
}

/** 首次读取时将当前 flat 配置迁入 providerProfiles[selectedProviderId]。 */
export function migrateLegacySttOnlineProviderProfiles(): void {
  const map = readProviderProfileMapRaw();
  if (Object.keys(map).length > 0) return;
  const selected = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId) ?? "openai").trim();
  const legacy = readFlatActiveSnapshotForMigration();
  if (!legacy) return;
  writeProviderProfileMap({ [selected]: legacy });
}

export function readSttOnlineProviderProfileSnapshot(
  providerId: string,
): SttOnlineProviderProfileSnapshot | undefined {
  migrateLegacySttOnlineProviderProfiles();
  return readProviderProfileMapRaw()[providerId];
}

/** 将当前厂商草稿写入 providerProfiles（含匹配的 connectionVerified 指纹）。 */
export function snapshotSttOnlineProviderProfile(
  providerId: string,
  draft: ExternalSttOnlineRuntimeConfig,
): void {
  migrateLegacySttOnlineProviderProfiles();
  const map = readProviderProfileMapRaw();
  const configFp = sttRuntimeConnectionFingerprint({ ...draft, enabled: true, selectedProviderId: providerId });
  const currentVerified = readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.connectionVerifiedFingerprint)?.trim();
  const existingVerified = map[providerId]?.connectionVerifiedFingerprint?.trim();
  const verifiedFingerprint =
    currentVerified === configFp
      ? currentVerified
      : existingVerified === configFp
        ? existingVerified
        : undefined;
  map[providerId] = {
    ...(draft.endpoint ? { endpoint: draft.endpoint } : {}),
    ...(draft.appKey ? { appKey: draft.appKey } : {}),
    ...(draft.apiKeyId ? { apiKeyId: draft.apiKeyId } : {}),
    ...(providerId === "iflytek-speed-asr" && draft.apiSecretId
      ? { apiSecretId: draft.apiSecretId }
      : {}),
    ...(draft.accent ? { accent: draft.accent } : {}),
    timeoutMs: draft.timeoutMs,
    ...(verifiedFingerprint ? { connectionVerifiedFingerprint: verifiedFingerprint } : {}),
  };
  writeProviderProfileMap(map);
}

/** 同步当前 active 配置到 providerProfiles（保存 / 探测成功后调用）。 */
export function syncSttOnlineProviderProfileFromActive(
  config: ExternalSttOnlineRuntimeConfig,
): void {
  snapshotSttOnlineProviderProfile(config.selectedProviderId, config);
}

export function restoreSttConnectionVerifiedForProvider(
  providerId: string,
  config: ExternalSttOnlineRuntimeConfig,
): void {
  const snapshot = readSttOnlineProviderProfileSnapshot(providerId);
  const configFp = sttRuntimeConnectionFingerprint({ ...config, enabled: true });
  const stored = snapshot?.connectionVerifiedFingerprint?.trim();
  if (stored && stored === configFp) {
    writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.connectionVerifiedFingerprint, stored);
  } else {
    try {
      localStorage.removeItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.connectionVerifiedFingerprint);
    } catch {
      /* ignore */
    }
  }
}

/** 清除某厂商 profile 中的密钥引用（不清钥匙串条目本身）。 */
export function clearSttOnlineProviderProfileCredentials(providerId: string): void {
  migrateLegacySttOnlineProviderProfiles();
  const map = readProviderProfileMapRaw();
  const prev = map[providerId];
  if (!prev) return;
  const next: SttOnlineProviderProfileSnapshot = { ...prev };
  delete next.apiKeyId;
  delete next.apiSecretId;
  delete next.connectionVerifiedFingerprint;
  map[providerId] = next;
  writeProviderProfileMap(map);
}

/** 讯飞专用槽位常量（供 runtimeConfig 推断引用）。 */
export const IFLYTEK_PROFILE_DEFAULT_KEY_ID = IFLYTEK_STT_API_KEY_ID;
export const IFLYTEK_PROFILE_DEFAULT_SECRET_ID = IFLYTEK_STT_API_SECRET_ID;
