import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STT_ONLINE_OPENAI_DEFAULT_TRANSCRIBE_URL,
  STT_ONLINE_PROVIDER_STORAGE_KEYS,
  isSttOnlineEnabledButIncomplete,
  setSttOnlineApiKeyInMemory,
  tryBuildOnlineTranscribeBridgePayload,
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

describe("tryBuildOnlineTranscribeBridgePayload", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage({}));
    setSttOnlineApiKeyInMemory(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setSttOnlineApiKeyInMemory(null);
  });

  it("returns null when session api key is missing", () => {
    expect(tryBuildOnlineTranscribeBridgePayload()).toBeNull();
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
    const p = tryBuildOnlineTranscribeBridgePayload();
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
    const p = tryBuildOnlineTranscribeBridgePayload();
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

  it("builds dashscope-asr native payload with preset endpoint", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "dashscope-asr",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("sk-test-bailian");
    const p = tryBuildOnlineTranscribeBridgePayload();
    expect(p?.nativeAdapter).toBe("dashscopeAsr");
    expect(p?.transcribeUrl).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    );
    expect(p?.authorization).toBe("Bearer sk-test-bailian");
  });

  it("builds deepgram native payload with preset listen URL", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "deepgram",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("dg-key");
    const p = tryBuildOnlineTranscribeBridgePayload();
    expect(p?.nativeAdapter).toBe("deepgramListen");
    expect(p?.transcribeUrl).toBe(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
    );
    expect(p?.authorization).toBe("Bearer dg-key");
  });

  it("resolves remaining shell native adapters", () => {
    expect(resolveShellNativeSttAdapterId("openai")).toBe("openaiAudio");
    expect(resolveShellNativeSttAdapterId("assemblyai")).toBe("assemblyai");
    expect(resolveShellNativeSttAdapterId("dashscope-asr")).toBe("dashscopeAsr");
    expect(resolveShellNativeSttAdapterId("deepgram")).toBe("deepgramListen");
    expect(resolveShellNativeSttAdapterId("aliyun-nls")).toBeNull();
  });

  it("migrates removed provider id when building bridge payload", () => {
    vi.stubGlobal(
      "localStorage",
      mockLocalStorage({
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.enabled]: "true",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.selectedProviderId]: "tencent-asr",
        [STT_ONLINE_PROVIDER_STORAGE_KEYS.timeoutMs]: "120000",
      }),
    );
    setSttOnlineApiKeyInMemory("sk-test-bailian");
    const p = tryBuildOnlineTranscribeBridgePayload();
    expect(p?.nativeAdapter).toBe("dashscopeAsr");
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
    const p = tryBuildOnlineTranscribeBridgePayload();
    expect(p?.appKey).toBe("app-xyz");
    expect(p?.nativeAdapter).toBeUndefined();
  });
});
