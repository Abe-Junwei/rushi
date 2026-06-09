import { describe, expect, it, beforeEach, vi } from "vitest";
import { STT_ONLINE_PROVIDER_STORAGE_KEYS } from "./sttOnlineProviderContract/constants";
import {
  isOnlineTranscribeReady,
  markSttConnectionVerified,
  setSttOnlineApiKeyInMemory,
  tryBuildOnlineTranscribeBridgePayload,
} from "./sttOnlineProviderContract";
import { normalizeExternalSttOnlineRuntimeConfig } from "./sttOnlineProviderContract/runtimeConfig";
import { resolveTranscribeSourceDescription } from "./transcribeSourcePresentation";

function mockLocalStorage(initial: Record<string, string>) {
  const data = { ...initial };
  return {
    getItem(key: string) {
      return data[key] ?? null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
    removeItem(key: string) {
      delete data[key];
    },
    clear() {
      for (const k of Object.keys(data)) delete data[k];
    },
  } as Storage;
}

describe("isOnlineTranscribeReady", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage({}));
    setSttOnlineApiKeyInMemory(null);
  });

  it("is false when payload buildable but connection not verified", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "dashscope-asr",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "30000",
      }),
    );
    setSttOnlineApiKeyInMemory("sk-test");
    expect(tryBuildOnlineTranscribeBridgePayload()).not.toBeNull();
    expect(isOnlineTranscribeReady()).toBe(false);
  });

  it("is true when api key id saved and connection verified", () => {
    const cfg = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "dashscope-asr",
      apiKeyId: "default",
      timeoutMs: 30_000,
    });
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "dashscope-asr",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.apiKeyId]: "default",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "30000",
      }),
    );
    markSttConnectionVerified(cfg);
    expect(isOnlineTranscribeReady()).toBe(true);
  });

  it("is true when payload buildable and connection verified", () => {
    const cfg = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "dashscope-asr",
      timeoutMs: 30_000,
    });
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "dashscope-asr",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "30000",
      }),
    );
    setSttOnlineApiKeyInMemory("sk-test");
    markSttConnectionVerified(cfg);
    expect(isOnlineTranscribeReady()).toBe(true);
  });
});

describe("resolveTranscribeSourceDescription", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage({}));
    setSttOnlineApiKeyInMemory(null);
  });

  it("describes local FunASR when source is local", () => {
    expect(resolveTranscribeSourceDescription("local")).toContain("FunASR");
  });

  it("describes selected online provider when ready", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "dashscope-asr",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "30000",
      }),
    );
    const text = resolveTranscribeSourceDescription("online", { onlineReady: true });
    expect(text).toContain("百炼");
    expect(text).not.toContain("尚未就绪");
  });

  it("warns when online selected but not ready", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "dashscope-asr",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "30000",
      }),
    );
    const text = resolveTranscribeSourceDescription("online", { onlineReady: false });
    expect(text).toContain("并探测");
    expect(text).toContain("保存 Key");
  });
});
