import { describe, expect, it, beforeEach, vi } from "vitest";
import { STT_ONLINE_PROVIDER_STORAGE_KEYS } from "./sttOnlineProviderContract/constants";
import {
  isSttConnectionVerified,
  markSttConnectionVerified,
  sttRuntimeConnectionFingerprint,
} from "./sttOnlineProviderContract/connectionVerified";
import {
  setSttOnlineApiKeyInMemory,
  setSttOnlineApiSecretInMemory,
} from "./sttOnlineProviderContract/memorySecrets";
import {
  normalizeExternalSttOnlineRuntimeConfig,
  persistExternalSttOnlineRuntimeConfig,
} from "./sttOnlineProviderContract/runtimeConfig";

describe("sttRuntimeConnectionFingerprint", () => {
  it("changes when persisted config fields change", () => {
    const base = {
      enabled: true,
      selectedProviderId: "openai",
      endpoint: undefined,
      appKey: undefined,
      timeoutMs: 30_000,
    };
    expect(sttRuntimeConnectionFingerprint(base)).not.toBe(
      sttRuntimeConnectionFingerprint({ ...base, endpoint: "https://api.test/v1/transcribe" }),
    );
    expect(sttRuntimeConnectionFingerprint(base)).not.toBe(
      sttRuntimeConnectionFingerprint({ ...base, enabled: false }),
    );
  });
});

describe("persistExternalSttOnlineRuntimeConfig verification fingerprint", () => {
  beforeEach(() => {
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
  });

  it("keeps connection verified when saving unchanged config", () => {
    const cfg = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "dashscope-asr",
      timeoutMs: 30_000,
    });
    persistExternalSttOnlineRuntimeConfig(cfg);
    markSttConnectionVerified(cfg);
    expect(isSttConnectionVerified(cfg)).toBe(true);

    persistExternalSttOnlineRuntimeConfig(cfg);
    expect(isSttConnectionVerified(cfg)).toBe(true);
  });

  it("clears connection verified when persisted fields change", () => {
    const cfg = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "dashscope-asr",
      timeoutMs: 30_000,
    });
    persistExternalSttOnlineRuntimeConfig(cfg);
    markSttConnectionVerified(cfg);

    persistExternalSttOnlineRuntimeConfig({
      ...cfg,
      selectedProviderId: "openai",
    });
    expect(isSttConnectionVerified(cfg)).toBe(false);
    expect(
      localStorage.getItem(STT_ONLINE_PROVIDER_STORAGE_KEYS.connectionVerifiedFingerprint),
    ).toBeNull();
  });
});

describe("isSttConnectionVerified with APISecret providers", () => {
  beforeEach(() => {
    setSttOnlineApiKeyInMemory(null);
    setSttOnlineApiSecretInMemory(null);
  });

  it("is false for iflytek-speed-asr when APISecret reference is missing", () => {
    const cfg = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "iflytek-speed-asr",
      appKey: "app-id",
      apiKeyId: "iflytek-api-key",
      timeoutMs: 120_000,
    });
    persistExternalSttOnlineRuntimeConfig(cfg);
    setSttOnlineApiKeyInMemory("api-key");
    markSttConnectionVerified(cfg);
    expect(isSttConnectionVerified(cfg)).toBe(false);
  });

  it("is true for iflytek-speed-asr when APISecret reference is persisted", () => {
    const cfg = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "iflytek-speed-asr",
      appKey: "app-id",
      apiKeyId: "iflytek-api-key",
      apiSecretId: "iflytek-api-secret",
      timeoutMs: 120_000,
    });
    persistExternalSttOnlineRuntimeConfig(cfg);
    setSttOnlineApiKeyInMemory("api-key");
    markSttConnectionVerified(cfg);
    expect(isSttConnectionVerified(cfg)).toBe(true);
  });

  it("is true when APISecret reference is persisted without session memory", () => {
    const cfg = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "iflytek-speed-asr",
      appKey: "app-id",
      apiKeyId: "iflytek-api-key",
      apiSecretId: "iflytek-api-secret",
      timeoutMs: 120_000,
    });
    persistExternalSttOnlineRuntimeConfig(cfg);
    setSttOnlineApiKeyInMemory("api-key");
    setSttOnlineApiSecretInMemory(null);
    markSttConnectionVerified(cfg);
    expect(isSttConnectionVerified(cfg)).toBe(true);
  });
});
