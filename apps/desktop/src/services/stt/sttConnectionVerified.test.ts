import { describe, expect, it, beforeEach, vi } from "vitest";
import { STT_ONLINE_PROVIDER_STORAGE_KEYS } from "./sttOnlineProviderContract/constants";
import {
  isSttConnectionVerified,
  markSttConnectionVerified,
  sttRuntimeConnectionFingerprint,
} from "./sttOnlineProviderContract/connectionVerified";
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
