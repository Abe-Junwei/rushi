import { beforeEach, describe, expect, it, vi } from "vitest";
import { STT_ONLINE_PROVIDER_STORAGE_KEYS } from "./constants";
import {
  isSttConnectionVerified,
  markSttConnectionVerified,
} from "./connectionVerified";
import {
  migrateLegacySttOnlineProviderProfiles,
  readSttOnlineProviderProfileSnapshot,
  snapshotSttOnlineProviderProfile,
} from "./providerProfiles";
import {
  normalizeExternalSttOnlineRuntimeConfig,
  persistExternalSttOnlineRuntimeConfig,
  readExternalSttOnlineRuntimeConfigFromStorage,
  switchSttOnlineProviderActive,
} from "./runtimeConfig";

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

describe("stt online provider profiles", () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
  });

  it("migrates legacy flat config into providerProfiles for selected provider", () => {
    localStorage.setItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId, "iflytek-speed-asr");
    localStorage.setItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey, "app-123");
    localStorage.setItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId, "iflytek-api-key");
    localStorage.setItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.apiSecretId, "iflytek-api-secret");
    localStorage.setItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs, "120000");

    migrateLegacySttOnlineProviderProfiles();
    const snap = readSttOnlineProviderProfileSnapshot("iflytek-speed-asr");
    expect(snap?.appKey).toBe("app-123");
    expect(snap?.apiKeyId).toBe("iflytek-api-key");
    expect(snap?.apiSecretId).toBe("iflytek-api-secret");
  });

  it("switching providers snapshots outgoing and restores incoming profile", () => {
    const dashscopeDraft = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "dashscope-asr",
      apiKeyId: "default",
      timeoutMs: 600_000,
    });
    persistExternalSttOnlineRuntimeConfig(dashscopeDraft);

    const iflytekDraft = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "iflytek-speed-asr",
      appKey: "xf-app",
      apiKeyId: "iflytek-api-key",
      apiSecretId: "iflytek-api-secret",
      accent: "mandarin",
      timeoutMs: 600_000,
    });
    snapshotSttOnlineProviderProfile("iflytek-speed-asr", iflytekDraft);

    const restored = switchSttOnlineProviderActive("dashscope-asr", "iflytek-speed-asr", dashscopeDraft);
    expect(restored.appKey).toBe("xf-app");
    expect(restored.apiKeyId).toBe("iflytek-api-key");
    expect(restored.apiSecretId).toBe("iflytek-api-secret");

    const backToDashscope = switchSttOnlineProviderActive(
      "iflytek-speed-asr",
      "dashscope-asr",
      iflytekDraft,
    );
    expect(backToDashscope.selectedProviderId).toBe("dashscope-asr");
    expect(backToDashscope.apiKeyId).toBe("default");
    expect(readExternalSttOnlineRuntimeConfigFromStorage().selectedProviderId).toBe("dashscope-asr");
  });

  it("restores per-provider connection verified fingerprint on switch back", () => {
    const iflytekCfg = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "iflytek-speed-asr",
      appKey: "xf-app",
      apiKeyId: "iflytek-api-key",
      apiSecretId: "iflytek-api-secret",
      timeoutMs: 600_000,
    });
    persistExternalSttOnlineRuntimeConfig(iflytekCfg);
    markSttConnectionVerified(iflytekCfg);
    snapshotSttOnlineProviderProfile("iflytek-speed-asr", iflytekCfg);

    const dashscopeDraft = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "dashscope-asr",
      timeoutMs: 600_000,
    });
    switchSttOnlineProviderActive("iflytek-speed-asr", "dashscope-asr", iflytekCfg);
    expect(isSttConnectionVerified(dashscopeDraft)).toBe(false);

    switchSttOnlineProviderActive("dashscope-asr", "iflytek-speed-asr", dashscopeDraft);
    expect(isSttConnectionVerified(iflytekCfg)).toBe(true);
  });
});
