import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LLM_API_KEY_ID,
  LLM_STORAGE_KEYS,
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY,
  applyLlmProviderPreset,
  isLlmConnectionVerified,
  markLlmConnectionVerified,
  persistLlmRuntimeConfig,
  persistLlmPromptOverrides,
  readLastCloudRuntimeConfig,
  readLlmRuntimeConfigFromStorage,
  setLlmApiKeyInMemory,
  isLocalLoopbackLlmProvider,
  isLlmRuntimeReady,
  tryBuildPostprocessRuntimeBridge,
  resolveLlmConnectionUiStatus,
} from "./postprocessRuntimeContract";

function installMockLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
}

describe("postprocessRuntimeContract", () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
    setLlmApiKeyInMemory(null);
  });

  it("defaults to deepseek preset", () => {
    const cfg = readLlmRuntimeConfigFromStorage();
    expect(cfg.providerId).toBe("deepseek");
    expect(cfg.baseUrl).toBe("https://api.deepseek.com/v1");
    expect(cfg.model).toBe("deepseek-chat");
  });

  it("persists kimi preset", () => {
    persistLlmRuntimeConfig(applyLlmProviderPreset("kimi"));
    setLlmApiKeyInMemory("sk-test");
    const bridge = tryBuildPostprocessRuntimeBridge();
    expect(bridge).toEqual({
      provider: "Kimi（Moonshot）",
      baseUrl: "https://api.moonshot.cn/v1",
      model: "moonshot-v1-8k",
      apiKey: "sk-test",
      allowInsecureHttp: undefined,
    });
  });

  it("persists qwen preset", () => {
    persistLlmRuntimeConfig(applyLlmProviderPreset("qwen"));
    const cfg = readLlmRuntimeConfigFromStorage();
    expect(cfg.providerId).toBe("qwen");
    expect(cfg.baseUrl).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1");
    expect(cfg.model).toBe("qwen-plus");
  });

  it("returns null bridge without api key", () => {
    persistLlmRuntimeConfig(applyLlmProviderPreset("deepseek"));
    expect(tryBuildPostprocessRuntimeBridge()).toBeNull();
  });

  it("includes prompt overrides in runtime bridge when configured", () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: DEFAULT_LLM_API_KEY_ID });
    persistLlmPromptOverrides({ stageBSystem: "custom system" });
    expect(tryBuildPostprocessRuntimeBridge()).toEqual({
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKeyId: DEFAULT_LLM_API_KEY_ID,
      allowInsecureHttp: undefined,
      promptOverrides: { stageBSystem: "custom system" },
    });
  });

  it("persists api key id for keychain-backed runtime", () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: DEFAULT_LLM_API_KEY_ID });
    expect(localStorage.getItem(LLM_STORAGE_KEYS.apiKeyId)).toBe(DEFAULT_LLM_API_KEY_ID);
    expect(isLlmRuntimeReady()).toBe(true);
    expect(tryBuildPostprocessRuntimeBridge()).toEqual({
      provider: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKeyId: DEFAULT_LLM_API_KEY_ID,
      allowInsecureHttp: undefined,
    });
  });

  it("migrates legacy postprocess storage keys", () => {
    localStorage.setItem("rushi.postprocess.providerId", "kimi");
    localStorage.setItem("rushi.postprocess.model", "moonshot-v1-32k");
    const cfg = readLlmRuntimeConfigFromStorage();
    expect(cfg.providerId).toBe("kimi");
    expect(cfg.model).toBe("moonshot-v1-32k");
    expect(localStorage.getItem(LLM_STORAGE_KEYS.providerId)).toBe("kimi");
  });

  it("falls back to deepseek for unknown provider ids", () => {
    localStorage.setItem(LLM_STORAGE_KEYS.providerId, "unknown-provider");
    const cfg = readLlmRuntimeConfigFromStorage();
    expect(cfg.providerId).toBe("deepseek");
    expect(cfg.baseUrl).toBe("https://api.deepseek.com/v1");
  });

  it("preserves api key id when persisting connection without apiKeyId field", () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: DEFAULT_LLM_API_KEY_ID });
    persistLlmRuntimeConfig(applyLlmProviderPreset("kimi"));
    expect(localStorage.getItem(LLM_STORAGE_KEYS.apiKeyId)).toBe(DEFAULT_LLM_API_KEY_ID);
    expect(isLlmRuntimeReady()).toBe(true);
  });

  it("sanitizes corrupt apiKeyId that looks like an API key", () => {
    localStorage.setItem(LLM_STORAGE_KEYS.apiKeyId, "sk-3dad49106a1b4065b472b6894bf0ab36");
    const cfg = readLlmRuntimeConfigFromStorage();
    expect(cfg.apiKeyId).toBe(DEFAULT_LLM_API_KEY_ID);
    expect(localStorage.getItem(LLM_STORAGE_KEYS.apiKeyId)).toBe(DEFAULT_LLM_API_KEY_ID);
  });

  it("ollama preset is ready without api key and builds loopback bridge", () => {
    persistLlmRuntimeConfig(applyLlmProviderPreset("ollama"));
    expect(isLocalLoopbackLlmProvider("ollama")).toBe(true);
    expect(isLlmRuntimeReady()).toBe(true);
    expect(tryBuildPostprocessRuntimeBridge()).toEqual({
      provider: "Ollama（本机）",
      baseUrl: OLLAMA_DEFAULT_BASE_URL,
      model: "qwen2.5:7b",
      apiKey: OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY,
      allowInsecureHttp: true,
    });
    expect(
      resolveLlmConnectionUiStatus({
        hasLocalKeyRef: true,
        hasTypedKey: false,
        keychainPresent: true,
        connectionVerified: true,
        localLoopback: true,
      }),
    ).toBe("verified");
  });

  it("snapshots and restores last cloud runtime config", () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("kimi"), apiKeyId: DEFAULT_LLM_API_KEY_ID });
    persistLlmRuntimeConfig(applyLlmProviderPreset("ollama"), { clearApiKeyId: true });
    const restored = readLastCloudRuntimeConfig();
    expect(restored.providerId).toBe("kimi");
    expect(restored.apiKeyId).toBe(DEFAULT_LLM_API_KEY_ID);
  });

  it("readLastCloudRuntimeConfig defaults to deepseek without snapshot", () => {
    expect(readLastCloudRuntimeConfig().providerId).toBe("deepseek");
  });

  it("keeps connection verified when persisting unchanged config", () => {
    const cfg = { ...applyLlmProviderPreset("deepseek"), apiKeyId: DEFAULT_LLM_API_KEY_ID };
    persistLlmRuntimeConfig(cfg);
    markLlmConnectionVerified(cfg);
    expect(isLlmConnectionVerified(cfg)).toBe(true);

    persistLlmRuntimeConfig(cfg);
    expect(isLlmConnectionVerified(cfg)).toBe(true);
  });

  it("clears connection verified when connection fingerprint changes", () => {
    const cfg = { ...applyLlmProviderPreset("deepseek"), apiKeyId: DEFAULT_LLM_API_KEY_ID };
    persistLlmRuntimeConfig(cfg);
    markLlmConnectionVerified(cfg);
    expect(isLlmConnectionVerified(cfg)).toBe(true);

    const changed = { ...cfg, model: "deepseek-reasoner" };
    persistLlmRuntimeConfig(changed);
    expect(isLlmConnectionVerified(changed)).toBe(false);
    expect(isLlmConnectionVerified(cfg)).toBe(false);
  });

  it("resolveLlmConnectionUiStatus uses persisted connectionVerified", () => {
    expect(
      resolveLlmConnectionUiStatus({
        hasLocalKeyRef: true,
        hasTypedKey: false,
        keychainPresent: true,
        connectionVerified: false,
      }),
    ).toBe("unverified");
    expect(
      resolveLlmConnectionUiStatus({
        hasLocalKeyRef: true,
        hasTypedKey: false,
        keychainPresent: true,
        connectionVerified: true,
      }),
    ).toBe("verified");
    expect(
      resolveLlmConnectionUiStatus({
        hasLocalKeyRef: true,
        hasTypedKey: false,
        keychainPresent: false,
        connectionVerified: false,
      }),
    ).toBe("keychain_missing");
  });
});
