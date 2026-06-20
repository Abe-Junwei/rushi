import { beforeEach, describe, expect, it } from "vitest";
import {
  activateLocalOllamaPreset,
  buildLlmEnvPresentation,
  buildLlmModeToggleTones,
  LLM_STATUS_REFRESH_BTN_BASE,
  LLM_STATUS_REFRESH_BTN_CLASS,
  llmPolishActiveMessage,
  llmPolishSourceDetailLabel,
  ollamaDetectReady,
  readLlmEnvMode,
  toneFromOllamaDetect,
} from "./llmEnvStatus";
import {
  applyLlmProviderPreset,
  clearLlmConnectionVerified,
  markLlmConnectionVerified,
  persistLlmRuntimeConfig,
  snapshotLastCloudRuntimeFromStorage,
} from "../postprocess/postprocessRuntimeContract";

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

describe("llmEnvStatus", () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
  });

  it("readLlmEnvMode returns local after ollama preset", () => {
    activateLocalOllamaPreset();
    expect(readLlmEnvMode()).toBe("local");
  });

  it("refresh button uses semantic accent for error and idle tones", () => {
    expect(LLM_STATUS_REFRESH_BTN_BASE).toContain("cursor-pointer");
    expect(LLM_STATUS_REFRESH_BTN_BASE).toContain("rounded-sm");
    expect(LLM_STATUS_REFRESH_BTN_BASE).toContain("enabled:hover:bg-notion-bg");
    expect(LLM_STATUS_REFRESH_BTN_BASE).not.toContain("shadow-sm");
    expect(LLM_STATUS_REFRESH_BTN_CLASS.error).toContain("text-zen-cinnabar");
    expect(LLM_STATUS_REFRESH_BTN_CLASS.error).toContain("enabled:hover:border-zen-cinnabar-border");
    expect(LLM_STATUS_REFRESH_BTN_CLASS.idle).toContain("text-notion-text-muted");
    expect(LLM_STATUS_REFRESH_BTN_CLASS.warn).toContain("text-zen-status-warn");
    expect(LLM_STATUS_REFRESH_BTN_CLASS.error).not.toContain("text-notion-text-muted");
  });

  it("toneFromOllamaDetect uses hasConfiguredModel when present", () => {
    expect(
      toneFromOllamaDetect(
        {
          reachable: true,
          modelCount: 2,
          hasQwen25_7b: false,
          hasConfiguredModel: true,
          message: "ok",
        },
        false,
      ),
    ).toBe("ok");
    expect(
      ollamaDetectReady({
        reachable: true,
        modelCount: 2,
        hasQwen25_7b: true,
        hasConfiguredModel: false,
        message: "missing",
      }),
    ).toBe(false);
  });

  it("cloud label shows provider only when verified", () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: "test-key" });
    expect(
      buildLlmEnvPresentation({
        ollamaDetect: null,
        ollamaDetectBusy: false,
      }).chipLabel,
    ).toBe("云端 DeepSeek 待验证");
    markLlmConnectionVerified();
    expect(
      buildLlmEnvPresentation({
        ollamaDetect: null,
        ollamaDetectBusy: false,
      }).chipLabel,
    ).toBe("云端 DeepSeek");
  });

  it("local label distinguishes readiness states", () => {
    activateLocalOllamaPreset();
    markLlmConnectionVerified();
    expect(
      buildLlmEnvPresentation({
        ollamaDetect: {
          reachable: true,
          modelCount: 1,
          hasQwen25_7b: true,
          hasConfiguredModel: true,
          message: "ok",
        },
        ollamaDetectBusy: false,
      }).chipLabel,
    ).toBe("本机 LLM");

    activateLocalOllamaPreset();
    clearLlmConnectionVerified();
    expect(
      buildLlmEnvPresentation({
        ollamaDetect: {
          reachable: true,
          modelCount: 1,
          hasQwen25_7b: true,
          hasConfiguredModel: true,
          message: "ok",
        },
        ollamaDetectBusy: false,
      }).chipLabel,
    ).toBe("本机 LLM 待验证");

    activateLocalOllamaPreset();
    expect(
      buildLlmEnvPresentation({
        ollamaDetect: {
          reachable: false,
          modelCount: 0,
          hasQwen25_7b: false,
          message: "connection refused",
        },
        ollamaDetectBusy: false,
      }).chipLabel,
    ).toBe("本机 LLM 未连接");
  });

  it("llmPolishSourceDetailLabel distinguishes local vs cloud", () => {
    expect(
      llmPolishSourceDetailLabel({ mode: "local", providerId: "ollama", model: "qwen2.5:7b" }),
    ).toBe("本机 Ollama · qwen2.5:7b");
    expect(
      llmPolishSourceDetailLabel({ mode: "cloud", providerId: "deepseek", model: "deepseek-chat" }),
    ).toBe("云端 DeepSeek · deepseek-chat");
  });

  it("llmPolishActiveMessage distinguishes local vs cloud", () => {
    expect(llmPolishActiveMessage("local")).toBe("正在使用本机 LLM 润色…");
    expect(llmPolishActiveMessage("cloud")).toBe("正在使用云端 LLM 润色…");
  });

  it("buildLlmEnvPresentation reflects local ollama readiness", () => {
    activateLocalOllamaPreset();
    markLlmConnectionVerified();
    const ready = buildLlmEnvPresentation({
      ollamaDetect: {
        reachable: true,
        modelCount: 1,
        hasQwen25_7b: true,
        hasConfiguredModel: true,
        message: "ok",
      },
      ollamaDetectBusy: false,
    });
    expect(ready.mode).toBe("local");
    expect(ready.ok).toBe(true);
    expect(ready.sourceLabel).toContain("本机 Ollama");
    expect(ready.blockReason).toBeNull();

    const blocked = buildLlmEnvPresentation({
      ollamaDetect: {
        reachable: false,
        modelCount: 0,
        hasQwen25_7b: false,
        message: "connection refused",
      },
      ollamaDetectBusy: false,
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.blockReason).toContain("connection refused");
  });

  it("buildLlmEnvPresentation keeps chip and banner in sync for cloud", () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: "test-key" });
    markLlmConnectionVerified();
    const p = buildLlmEnvPresentation({ ollamaDetect: null, ollamaDetectBusy: false });
    expect(p.chipLabel).toBe("云端 DeepSeek");
    expect(p.bannerTitle).toContain("连接就绪");
    expect(p.bannerDetail).toContain("已验证");
    expect(p.ok).toBe(true);
    expect(p.capabilityBadge).toBe("可用");
  });

  it("local ollama detect busy shows in-progress banner copy", () => {
    activateLocalOllamaPreset();
    const p = buildLlmEnvPresentation({
      ollamaDetect: {
        reachable: false,
        modelCount: 0,
        hasQwen25_7b: false,
        message: "未检测到 Ollama 服务",
      },
      ollamaDetectBusy: true,
    });
    expect(p.bannerTitle).toBe("本机 LLM（Ollama）· 检测中");
    expect(p.bannerDetail).toBe("正在检测 127.0.0.1:11434…");
  });

  it("local ollama tags ready shows F2 service-ready copy and pending capability", () => {
    activateLocalOllamaPreset();
    const p = buildLlmEnvPresentation({
      ollamaDetect: {
        reachable: true,
        modelCount: 1,
        hasQwen25_7b: true,
        hasConfiguredModel: true,
        message: "",
      },
      ollamaDetectBusy: false,
    });
    expect(p.bannerTitle).toBe("本机 LLM（Ollama）· 服务就绪");
    expect(p.bannerDetail).toContain("Ollama 已响应");
    expect(p.capabilityBadge).toBe("待验证");
    expect(p.tone).toBe("warn");
  });

  it("buildLlmModeToggleTones reports both sides independently", () => {
    activateLocalOllamaPreset();
    markLlmConnectionVerified();
    const ollamaOk = {
      reachable: true,
      modelCount: 1,
      hasQwen25_7b: true,
      hasConfiguredModel: true,
      message: "ok",
    } as const;
    const localActive = buildLlmModeToggleTones({
      ollamaDetect: ollamaOk,
      ollamaDetectBusy: false,
    });
    expect(localActive.local).toBe("ok");
    expect(localActive.cloud).toBe("error");

    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: "test-key" });
    markLlmConnectionVerified();
    const cloudActive = buildLlmModeToggleTones({
      ollamaDetect: {
        reachable: false,
        modelCount: 0,
        hasQwen25_7b: false,
        message: "down",
      },
      ollamaDetectBusy: false,
    });
    expect(cloudActive.cloud).toBe("ok");
    expect(cloudActive.local).toBe("error");

    snapshotLastCloudRuntimeFromStorage();
    activateLocalOllamaPreset();
    markLlmConnectionVerified();
    const cloudSnapshot = buildLlmModeToggleTones({
      ollamaDetect: ollamaOk,
      ollamaDetectBusy: false,
    });
    expect(cloudSnapshot.local).toBe("ok");
    expect(cloudSnapshot.cloud).toBe("warn");
  });

  it("config draft overlay drives banner vendor before save", () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: "test-key" });
    const p = buildLlmEnvPresentation({
      ollamaDetect: null,
      ollamaDetectBusy: false,
      settings: {
        hasLocalKeyRef: true,
        hasTypedKey: false,
        keychainPresent: true,
        configDraft: {
          providerId: "kimi",
          baseUrl: "https://api.moonshot.cn/v1",
          model: "moonshot-v1-8k",
        },
      },
    });
    expect(p.bannerTitle).toContain("Kimi");
    expect(p.configDraftDirty).toBe(true);
    expect(p.bannerDetail).toContain("连接已改");
    expect(p.blockReason).toContain("连接已改");
  });
});
