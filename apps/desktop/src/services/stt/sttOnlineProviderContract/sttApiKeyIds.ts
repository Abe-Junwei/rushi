export const DEFAULT_STT_API_KEY_ID = "default";

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
