import { STT_ONLINE_PROVIDER_STORAGE_KEYS } from "./constants";
import { getSttOnlineApiKeyFromMemory } from "./memorySecrets";
import { readStorage, writeStorage } from "./storage";
import { DEFAULT_STT_API_KEY_ID, normalizeSttApiKeyId } from "./sttApiKeyIds";
import { sttHasStoredApiKey } from "../../../tauri/sttApi";

let ensureSttOnlineApiKeyInflight: Promise<boolean> | null = null;

export function readSttOnlineApiKeyIdFromStorage(): string | undefined {
  const rawApiKeyId = (readStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId) ?? "").trim();
  const apiKeyId = normalizeSttApiKeyId(rawApiKeyId);
  if (rawApiKeyId && apiKeyId && rawApiKeyId !== apiKeyId) {
    writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId, apiKeyId);
  } else if (rawApiKeyId && !apiKeyId) {
    try {
      localStorage.removeItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId);
    } catch {
      /* ignore */
    }
  }
  return apiKeyId;
}

export type PersistSttOnlineApiKeyIdOptions = {
  clearApiKeyId?: boolean;
};

export function persistSttOnlineApiKeyId(
  apiKeyId: string | null | undefined,
  options?: PersistSttOnlineApiKeyIdOptions,
): void {
  if (options?.clearApiKeyId) {
    try {
      localStorage.removeItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId);
    } catch {
      /* ignore */
    }
    return;
  }
  const normalized = normalizeSttApiKeyId(apiKeyId);
  if (normalized) {
    writeStorage(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId, normalized);
  }
}

export function hasSttOnlineApiKeyReference(): boolean {
  return Boolean(getSttOnlineApiKeyFromMemory()?.trim() || readSttOnlineApiKeyIdFromStorage());
}

/** 仅检查本地密钥引用；已保存密钥由 Rust 在探测 / 转写时解析。 */
export async function ensureSttOnlineApiKeyForSession(): Promise<boolean> {
  if (getSttOnlineApiKeyFromMemory()?.trim()) return true;
  if (ensureSttOnlineApiKeyInflight) return ensureSttOnlineApiKeyInflight;

  ensureSttOnlineApiKeyInflight = (async () => {
    if (getSttOnlineApiKeyFromMemory()?.trim()) return true;
    const apiKeyId = readSttOnlineApiKeyIdFromStorage();
    if (!apiKeyId) return false;
    try {
      return await sttHasStoredApiKey({ apiKeyId: apiKeyId ?? DEFAULT_STT_API_KEY_ID });
    } catch {
      return false;
    }
  })();

  try {
    return await ensureSttOnlineApiKeyInflight;
  } finally {
    ensureSttOnlineApiKeyInflight = null;
  }
}
