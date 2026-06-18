import { notifySttOnlineRuntimeChanged } from "../sttOnlineRuntimeNotify";

const inMemorySttSecrets: { apiKey?: string; apiSecret?: string } = {};

/** 会话内存中的 API Key 明文（持久化走 AppData 受保护文件 + localStorage apiKeyId 引用；macOS 不走钥匙串）。 */
export function setSttOnlineApiKeyInMemory(apiKey: string | null | undefined): void {
  const t = apiKey?.trim();
  if (t) inMemorySttSecrets.apiKey = t;
  else delete inMemorySttSecrets.apiKey;
  notifySttOnlineRuntimeChanged();
}

export function getSttOnlineApiKeyFromMemory(): string | undefined {
  return inMemorySttSecrets.apiKey;
}

/** 讯飞 APISecret；与 APIKey 同存 AppData 受保护文件，运行时注入会话内存。 */
export function setSttOnlineApiSecretInMemory(apiSecret: string | null | undefined): void {
  const t = apiSecret?.trim();
  if (t) inMemorySttSecrets.apiSecret = t;
  else delete inMemorySttSecrets.apiSecret;
  notifySttOnlineRuntimeChanged();
}

export function getSttOnlineApiSecretFromMemory(): string | undefined {
  return inMemorySttSecrets.apiSecret;
}

export function clearSttOnlineSecretsInMemory(): void {
  delete inMemorySttSecrets.apiKey;
  delete inMemorySttSecrets.apiSecret;
  notifySttOnlineRuntimeChanged();
}
