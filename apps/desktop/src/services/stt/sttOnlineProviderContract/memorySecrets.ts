const inMemorySttSecrets: { apiKey?: string } = {};

/** 仅内存保存 API Key（与解语 acoustic 一致：不落 localStorage）。 */
export function setSttOnlineApiKeyInMemory(apiKey: string | null | undefined): void {
  const t = apiKey?.trim();
  if (t) inMemorySttSecrets.apiKey = t;
  else delete inMemorySttSecrets.apiKey;
}

export function getSttOnlineApiKeyFromMemory(): string | undefined {
  return inMemorySttSecrets.apiKey;
}
