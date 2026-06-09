import { notifySttOnlineRuntimeChanged } from "../sttOnlineRuntimeNotify";

const inMemorySttSecrets: { apiKey?: string } = {};

/** 会话内存中的 API Key 明文（持久化走钥匙串 / AppData 受保护文件 + localStorage apiKeyId 引用）。 */
export function setSttOnlineApiKeyInMemory(apiKey: string | null | undefined): void {
  const t = apiKey?.trim();
  if (t) inMemorySttSecrets.apiKey = t;
  else delete inMemorySttSecrets.apiKey;
  notifySttOnlineRuntimeChanged();
}

export function getSttOnlineApiKeyFromMemory(): string | undefined {
  return inMemorySttSecrets.apiKey;
}
