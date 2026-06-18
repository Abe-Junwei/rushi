export const DEFAULT_STT_API_KEY_ID = "default";

/** 讯飞 speedTranscription 专用槽位，避免与百炼 sk- 共用 `default`。 */
export const IFLYTEK_STT_API_KEY_ID = "iflytek-api-key";

/** 讯飞 APISecret 专用槽位（与 APIKey 分存）。 */
export const IFLYTEK_STT_API_SECRET_ID = "iflytek-api-secret";

export function resolveSttApiKeyIdForProvider(providerId: string): string {
  return providerId === "iflytek-speed-asr" ? IFLYTEK_STT_API_KEY_ID : DEFAULT_STT_API_KEY_ID;
}

export function resolveSttApiSecretIdForProvider(providerId: string): string | undefined {
  return providerId === "iflytek-speed-asr" ? IFLYTEK_STT_API_SECRET_ID : undefined;
}

/** 讯飞槽位误存了百炼 sk- 等不兼容密钥时的 apiKeyId 引用。 */
export function isStaleSttApiKeyIdForProvider(providerId: string, apiKeyId: string | undefined | null): boolean {
  const id = (apiKeyId ?? "").trim();
  if (!id) return false;
  if (providerId === "iflytek-speed-asr" && id === DEFAULT_STT_API_KEY_ID) return true;
  if (providerId !== "iflytek-speed-asr" && id === IFLYTEK_STT_API_KEY_ID) return true;
  return false;
}

/** apiKeyId 只能是钥匙串条目名（如 default），不能是 API Key 本身。 */
export function isCorruptSttApiKeyId(raw: string | undefined | null): boolean {
  const id = (raw ?? "").trim();
  if (!id) return false;
  if (id.startsWith("sk-") || id.startsWith("Bearer ")) return true;
  if (id.length > 48) return true;
  return !/^[A-Za-z0-9_-]+$/.test(id);
}

export function normalizeSttApiKeyId(raw: string | undefined | null): string | undefined {
  const id = (raw ?? "").trim();
  if (!id) return undefined;
  if (isCorruptSttApiKeyId(id)) return DEFAULT_STT_API_KEY_ID;
  return id;
}
