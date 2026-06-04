import { beforeEach, describe, expect, it } from "vitest";
import {
  activateLocalOllamaPreset,
  buildLlmEnvPresentation,
  buildLlmPolishReadiness,
  llmPolishActiveMessage,
  llmPolishSourceDetailLabel,
  llmTopStatusShortLabel,
  ollamaDetectReady,
  readLlmEnvMode,
  toneFromOllamaDetect,
} from "./llmEnvStatus";
import {
  applyLlmProviderPreset,
  markLlmConnectionVerified,
  persistLlmRuntimeConfig,
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
    persistLlmRuntimeConfig(applyLlmProviderPreset("deepseek"));
    expect(
      llmTopStatusShortLabel({
        mode: "cloud",
        ollamaTone: "ok",
        providerId: "deepseek",
        cloudConnectionVerified: true,
        runtimeReady: true,
      }),
    ).toBe("云端 DeepSeek");
    expect(
      llmTopStatusShortLabel({
        mode: "cloud",
        ollamaTone: "ok",
        providerId: "deepseek",
        cloudConnectionVerified: false,
        runtimeReady: true,
      }),
    ).toBe("云端 DeepSeek 待验证");
  });

  it("local label distinguishes readiness states", () => {
    expect(
      llmTopStatusShortLabel({
        mode: "local",
        ollamaTone: "ok",
        providerId: "ollama",
        cloudConnectionVerified: true,
        runtimeReady: true,
      }),
    ).toBe("本机 LLM");
    expect(
      llmTopStatusShortLabel({
        mode: "local",
        ollamaTone: "ok",
        providerId: "ollama",
        cloudConnectionVerified: false,
        runtimeReady: true,
      }),
    ).toBe("本机 LLM 待验证");
    expect(
      llmTopStatusShortLabel({
        mode: "local",
        ollamaTone: "error",
        providerId: "ollama",
        cloudConnectionVerified: false,
        runtimeReady: true,
      }),
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

  it("buildLlmPolishReadiness for local requires ollama ready and verified", () => {
    activateLocalOllamaPreset();
    markLlmConnectionVerified();
    const ready = buildLlmPolishReadiness({
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
    expect(ready.ready).toBe(true);
    expect(ready.sourceLabel).toContain("本机 Ollama");
    expect(ready.blockReason).toBeNull();

    const blocked = buildLlmPolishReadiness({
      ollamaDetect: {
        reachable: false,
        modelCount: 0,
        hasQwen25_7b: false,
        message: "connection refused",
      },
      ollamaDetectBusy: false,
    });
    expect(blocked.ready).toBe(false);
    expect(blocked.blockReason).toContain("connection refused");
  });

  it("buildLlmEnvPresentation keeps chip and banner in sync for cloud", () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: "test-key" });
    markLlmConnectionVerified();
    const p = buildLlmEnvPresentation({ ollamaDetect: null, ollamaDetectBusy: false });
    expect(p.chipLabel).toBe("云端 DeepSeek");
    expect(p.bannerTitle).toContain("连接就绪");
    expect(p.ok).toBe(true);
    expect(p.capabilityBadge).toBe("可用");
  });
});
