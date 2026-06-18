import { STT_ONLINE_PROVIDER_STORAGE_KEYS } from "./constants";
import { getSttOnlineProviderDefinition } from "./definitions";
import { getSttOnlineApiSecretFromMemory, setSttOnlineApiSecretInMemory } from "./memorySecrets";
import { readExternalSttOnlineRuntimeConfigFromStorage } from "./runtimeConfig";
import { readStorage, writeStorage } from "./storage";
import {
  IFLYTEK_STT_API_SECRET_ID,
  normalizeSttApiKeyId,
  resolveSttApiSecretIdForProvider,
} from "./sttApiKeyIds";
import { sttReadApiKey } from "../../../tauri/sttApi";

let ensureSttOnlineApiSecretInflight: Promise<boolean> | null = null;

export function readSttOnlineApiSecretIdFromStorage(): string | undefined {
  const rawApiSecretId = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiSecretId) ?? "").trim();
  const apiSecretId = normalizeSttApiKeyId(rawApiSecretId);
  if (rawApiSecretId && apiSecretId && rawApiSecretId !== apiSecretId) {
    writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiSecretId, apiSecretId);
  } else if (rawApiSecretId && !apiSecretId) {
    try {
      localStorage.removeItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiSecretId);
    } catch {
      /* ignore */
    }
  }
  return apiSecretId;
}

export type PersistSttOnlineApiSecretIdOptions = {
  clearApiSecretId?: boolean;
};

export function persistSttOnlineApiSecretId(
  apiSecretId: string | null | undefined,
  options?: PersistSttOnlineApiSecretIdOptions,
): void {
  if (options?.clearApiSecretId) {
    try {
      localStorage.removeItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiSecretId);
    } catch {
      /* ignore */
    }
    return;
  }
  const normalized = normalizeSttApiKeyId(apiSecretId);
  if (normalized) {
    writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiSecretId, normalized);
  }
}

export function hasSttOnlineApiSecretReference(): boolean {
  const providerId = readExternalSttOnlineRuntimeConfigFromStorage().selectedProviderId;
  const def = getSttOnlineProviderDefinition(providerId);
  if (!def?.requiresApiSecret) return true;
  return Boolean(getSttOnlineApiSecretFromMemory()?.trim() || readSttOnlineApiSecretIdFromStorage());
}

/** 从本地受保护存储读回 APISecret 并注入会话内存（供探测 / 转写使用）。 */
export async function ensureSttOnlineApiSecretForSession(): Promise<boolean> {
  const providerId = readExternalSttOnlineRuntimeConfigFromStorage().selectedProviderId;
  if (!resolveSttApiSecretIdForProvider(providerId)) return true;
  if (getSttOnlineApiSecretFromMemory()?.trim()) return true;
  if (ensureSttOnlineApiSecretInflight) return ensureSttOnlineApiSecretInflight;

  ensureSttOnlineApiSecretInflight = (async () => {
    if (getSttOnlineApiSecretFromMemory()?.trim()) return true;
    const apiSecretId = readSttOnlineApiSecretIdFromStorage();
    if (!apiSecretId) return false;
    try {
      const secret = await sttReadApiKey({ apiKeyId: apiSecretId ?? IFLYTEK_STT_API_SECRET_ID });
      if (!secret?.trim()) return false;
      setSttOnlineApiSecretInMemory(secret);
      return true;
    } catch {
      return false;
    }
  })();

  try {
    return await ensureSttOnlineApiSecretInflight;
  } finally {
    ensureSttOnlineApiSecretInflight = null;
  }
}
