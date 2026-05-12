import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STT_ONLINE_OPENAI_DEFAULT_TRANSCRIBE_URL,
  STT_ONLINE_PROVIDER_STORAGE_KEYS,
  isAllowedSttOnlineEndpoint,
  isSttOnlineEnabledButIncomplete,
  normalizeExternalSttOnlineRuntimeConfig,
  resolveSttOnlineProbeUrl,
  setSttOnlineApiKeyInMemory,
  sttOnlineProvidersByMarket,
  tryBuildP1OnlineTranscribeBridgePayload,
  resolveShellNativeSttAdapterId,
} from "./sttOnlineProviderContract";

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
    key() {
      return null;
    },
    get length() {
      return Object.keys(data).length;
    },
  } as Storage;
}

describe("isAllowedSttOnlineEndpoint", () => {
  it("allows https", () => {
    expect(isAllowedSttOnlineEndpoint("https://api.openai.com/v1")).toBe(true);
  });

  it("allows http on loopback only", () => {
    expect(isAllowedSttOnlineEndpoint("http://127.0.0.1:8741")).toBe(true);
    expect(isAllowedSttOnlineEndpoint("http://localhost:3000")).toBe(true);
    expect(isAllowedSttOnlineEndpoint("http://example.com")).toBe(false);
  });
});

describe("normalizeExternalSttOnlineRuntimeConfig", () => {
  it("falls back unknown provider id to openai", () => {
    const c = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "unknown-vendor",
      timeoutMs: 5000,
    });
    expect(c.selectedProviderId).toBe("openai");
  });

  it("keeps appKey when provided", () => {
    const c = normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: "aliyun-nls",
      appKey: "  my-app-key ",
      timeoutMs: 5000,
    });
    expect(c.appKey).toBe("my-app-key");
  });
});

describe("sttOnlineProvidersByMarket", () => {
  it("includes aliyun under china", () => {
    const ids = sttOnlineProvidersByMarket("china").map((d) => d.id);
    expect(ids).toContain("aliyun-nls");
    expect(ids).toContain("tencent-asr");
  });

  it("lists free-tier-noted providers before others within each market", () => {
    const china = sttOnlineProvidersByMarket("china").map((d) => d.id);
    expect(china.indexOf("aispeech")).toBe(china.length - 1);

    const globalIds = sttOnlineProvidersByMarket("global").map((d) => d.id);
    expect(globalIds[globalIds.length - 1]).toBe("custom-proxy");
  });
});

describe("tryBuildP1OnlineTranscribeBridgePayload", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage({}));
    setSttOnlineApiKeyInMemory(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setSttOnlineApiKeyInMemory(null);
  });

  it("returns null when online STT is not enabled in storage", () => {
    expect(tryBuildP1OnlineTranscribeBridgePayload()).toBeNull();
  });

  it("builds OpenAI native payload without custom endpoint when key present", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "openai",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("sk-test");
    const p = tryBuildP1OnlineTranscribeBridgePayload();
    expect(p).not.toBeNull();
    expect(p?.nativeAdapter).toBe("openaiAudio");
    expect(p?.transcribeUrl).toBe(STT_ONLINE_OPENAI_DEFAULT_TRANSCRIBE_URL);
    expect(p?.authorization).toBe("Bearer sk-test");
  });

  it("builds AssemblyAI native payload with default base", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "assemblyai",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("aa-test");
    const p = tryBuildP1OnlineTranscribeBridgePayload();
    expect(p?.nativeAdapter).toBe("assemblyai");
    expect(p?.transcribeUrl).toBe("https://api.assemblyai.com");
    expect(p?.authorization).toBe("aa-test");
  });

  it("isSttOnlineEnabledButIncomplete is false for OpenAI with key only", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "openai",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("sk-x");
    expect(isSttOnlineEnabledButIncomplete()).toBe(false);
  });

  it("is incomplete for aliyun-nls when token present but appKey missing", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "aliyun-nls",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("some-token");
    expect(isSttOnlineEnabledButIncomplete()).toBe(true);
  });

  it("builds aliyun-nls native payload with appKey and empty endpoint", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "aliyun-nls",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey]: "my-nls-appkey",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("nls-token");
    const p = tryBuildP1OnlineTranscribeBridgePayload();
    expect(p?.nativeAdapter).toBe("aliyunNls");
    expect(p?.transcribeUrl).toBe("");
    expect(p?.appKey).toBe("my-nls-appkey");
    expect(p?.authorization).toBe("nls-token");
  });

  it("builds deepgram native payload with default empty listen URL", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "deepgram",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("dg-key");
    const p = tryBuildP1OnlineTranscribeBridgePayload();
    expect(p?.nativeAdapter).toBe("deepgramListen");
    expect(p?.transcribeUrl).toBe("");
    expect(p?.authorization).toBe("Bearer dg-key");
  });

  it("resolves china native adapters", () => {
    expect(resolveShellNativeSttAdapterId("iflytek-speech")).toBe("iflytekIatWs");
    expect(resolveShellNativeSttAdapterId("huawei-sis")).toBe("huaweiSisShortAudio");
    expect(resolveShellNativeSttAdapterId("volcengine-speech")).toBe("volcengineBigmodelNostreamWs");
    expect(resolveShellNativeSttAdapterId("aispeech")).toBe("aispeechLasrSentenceV2");
  });

  it("builds iflytek payload with pipe secret and app id", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "iflytek-speech",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey]: "appid-123",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("apikeyxxx|secretxxx");
    const p = tryBuildP1OnlineTranscribeBridgePayload();
    expect(p?.nativeAdapter).toBe("iflytekIatWs");
    expect(p?.appKey).toBe("appid-123");
    expect(p?.authorization).toBe("apikeyxxx|secretxxx");
  });

  it("builds huawei-sis native payload with pipe AK/SK and project id", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "huawei-sis",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey]: "proj-abc",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("AKID|SECRETKEY");
    const p = tryBuildP1OnlineTranscribeBridgePayload();
    expect(p?.nativeAdapter).toBe("huaweiSisShortAudio");
    expect(p?.appKey).toBe("proj-abc");
    expect(p?.authorization).toBe("Bearer AKID|SECRETKEY");
    expect(p?.transcribeUrl).toBe("");
  });

  it("builds aispeech native payload with bearer api key", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "aispeech",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey]: "product-99",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("lasr-key");
    const p = tryBuildP1OnlineTranscribeBridgePayload();
    expect(p?.nativeAdapter).toBe("aispeechLasrSentenceV2");
    expect(p?.appKey).toBe("product-99");
    expect(p?.authorization).toBe("Bearer lasr-key");
    expect(p?.transcribeUrl).toBe("");
  });

  it("builds volcengine-speech native payload with bearer token", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "volcengine-speech",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey]: "app-key-volc",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("access-token-xyz");
    const p = tryBuildP1OnlineTranscribeBridgePayload();
    expect(p?.nativeAdapter).toBe("volcengineBigmodelNostreamWs");
    expect(p?.appKey).toBe("app-key-volc");
    expect(p?.authorization).toBe("Bearer access-token-xyz");
    expect(p?.transcribeUrl).toBe("");
  });

  it("builds baidu native payload when API Key persisted and secret in memory", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "baidu-speech",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey]: "baidu-api-key",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("baidu-secret");
    const p = tryBuildP1OnlineTranscribeBridgePayload();
    expect(p?.nativeAdapter).toBe("baiduSpeech");
    expect(p?.appKey).toBe("baidu-api-key");
    expect(p?.authorization).toBe("Bearer baidu-secret");
  });

  it("isSttOnlineEnabledButIncomplete is false for deepgram with key only", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "deepgram",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("dg");
    expect(isSttOnlineEnabledButIncomplete()).toBe(false);
  });

  it("includes persisted appKey in custom bridge payload", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "custom-proxy",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.endpoint]: "https://proxy.example.com/v1/transcribe",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.appKey]: "app-xyz",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("proxy-secret");
    const p = tryBuildP1OnlineTranscribeBridgePayload();
    expect(p?.appKey).toBe("app-xyz");
    expect(p?.nativeAdapter).toBeUndefined();
  });
});

describe("resolveSttOnlineProbeUrl", () => {
  it("uses explicit endpoint when valid", () => {
    expect(
      resolveSttOnlineProbeUrl(
        normalizeExternalSttOnlineRuntimeConfig({
          enabled: true,
          selectedProviderId: "deepgram",
          endpoint: "https://api.deepgram.com",
          timeoutMs: 5000,
        }),
      ),
    ).toBe("https://api.deepgram.com");
  });

  it("returns default OpenAI probe when endpoint empty", () => {
    expect(
      resolveSttOnlineProbeUrl(
        normalizeExternalSttOnlineRuntimeConfig({
          enabled: true,
          selectedProviderId: "openai",
          timeoutMs: 5000,
        }),
      ),
    ).toBe("https://api.openai.com/v1/models");
  });
});
