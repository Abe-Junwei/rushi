import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildOnlineSttEnvPresentation } from "./onlineSttEnvStatus";
import { readOnlineSttEnvNavTone } from "./readOnlineSttEnvNavPresentation";
import {
  hasSttOnlineApiKeyReference,
  isSttConnectionVerified,
  markSttConnectionVerified,
  normalizeExternalSttOnlineRuntimeConfig,
  persistExternalSttOnlineRuntimeConfig,
  readExternalSttOnlineRuntimeConfigFromStorage,
} from "./sttOnlineProviderContract";

function installMockLocalStorage() {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => storage.clear(),
  });
}

function panelToneForStoredConfig(): string {
  const stored = readExternalSttOnlineRuntimeConfigFromStorage();
  const draftConfig = normalizeExternalSttOnlineRuntimeConfig({
    ...stored,
    enabled: true,
    apiKeyId: stored.apiKeyId,
    apiSecretId: stored.apiSecretId,
  });
  return buildOnlineSttEnvPresentation({
    enabled: true,
    providerId: draftConfig.selectedProviderId,
    endpoint: draftConfig.endpoint ?? "",
    appKey: draftConfig.appKey ?? "",
    hasApiKeyReference: hasSttOnlineApiKeyReference(),
    hasTypedApiKey: false,
    keychainReady: null,
    connectionVerified: isSttConnectionVerified(draftConfig),
    lastProbeAvailable: null,
    lastProbeMessage: null,
  }).tone;
}

describe("readOnlineSttEnvNavTone", () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
  });

  it("matches panel tone for verified iflytek-speed-asr with apiSecret persisted", () => {
    const cfg = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "iflytek-speed-asr",
      appKey: "app-id",
      apiKeyId: "iflytek-api-key",
      apiSecretId: "iflytek-api-secret",
      accent: "mandarin",
      timeoutMs: 600_000,
    });
    persistExternalSttOnlineRuntimeConfig(cfg);
    markSttConnectionVerified(cfg);

    expect(readOnlineSttEnvNavTone()).toBe("ok");
    expect(panelToneForStoredConfig()).toBe("ok");
  });

  it("warns when iflytek apiSecret is missing from persisted config", () => {
    const cfg = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "iflytek-speed-asr",
      appKey: "app-id",
      apiKeyId: "iflytek-api-key",
      accent: "mandarin",
      timeoutMs: 600_000,
    });
    persistExternalSttOnlineRuntimeConfig(cfg);

    expect(readOnlineSttEnvNavTone()).toBe("warn");
  });
});
