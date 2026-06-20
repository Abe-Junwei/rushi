import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildOnlineSttEnvPresentation } from "./onlineSttEnvStatus";
import { buildOnlineSttEnvPresentationInputFromStorage } from "./onlineSttEnvPresentationInput";
import { readOnlineSttEnvNavTone } from "./readOnlineSttEnvNavPresentation";
import {
  markSttConnectionVerified,
  normalizeExternalSttOnlineRuntimeConfig,
  persistExternalSttOnlineRuntimeConfig,
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

function panelToneForStoredConfig(keychainReady: boolean | null = null): string {
  return buildOnlineSttEnvPresentation(
    buildOnlineSttEnvPresentationInputFromStorage({ keychainReady }),
  ).tone;
}

describe("readOnlineSttEnvNavTone", () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
  });

  it("matches panel tone when online STT is disabled and empty", () => {
    persistExternalSttOnlineRuntimeConfig(
      normalizeExternalSttOnlineRuntimeConfig({
        enabled: false,
        selectedProviderId: "openai",
      }),
    );

    expect(readOnlineSttEnvNavTone()).toBe("idle");
    expect(panelToneForStoredConfig()).toBe("idle");
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

    expect(readOnlineSttEnvNavTone(true)).toBe("ok");
    expect(panelToneForStoredConfig(true)).toBe("ok");
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
    expect(panelToneForStoredConfig()).toBe("warn");
  });
});
