import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLlmEnvStatus } from "./useLlmEnvStatus";
import {
  applyLlmProviderPreset,
  markLlmConnectionVerified,
  persistLlmRuntimeConfig,
} from "../services/postprocess/postprocessRuntimeContract";
import { activateLocalOllamaPreset } from "../services/llm/llmEnvStatus";
import {
  refreshLlmOllamaDetect,
  resetLlmEnvRuntimeStoreForTests,
} from "../services/llm/llmEnvRuntimeStore";

const ollamaDetectStatus = vi.fn<
  () => Promise<{
    reachable: boolean;
    modelCount: number;
    hasQwen25_7b: boolean;
    hasConfiguredModel?: boolean;
    message: string;
  }>
>();

vi.mock("../tauri/postprocessApi", () => ({
  ollamaDetectStatus: () => ollamaDetectStatus(),
}));

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

describe("useLlmEnvStatus", () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
    resetLlmEnvRuntimeStoreForTests();
    ollamaDetectStatus.mockReset();
    ollamaDetectStatus.mockResolvedValue({
      reachable: true,
      modelCount: 1,
      hasQwen25_7b: true,
      hasConfiguredModel: true,
      message: "Ollama 就绪",
    });
  });

  it("updates top bar label after cloud connection verified event", async () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: "deepseek" });

    const { result } = renderHook(() => useLlmEnvStatus(0));

    await waitFor(() => {
      expect(result.current.shortLabel).toContain("待验证");
    });
    expect(result.current.topBarOk).toBe(false);

    act(() => {
      markLlmConnectionVerified();
    });

    await waitFor(() => {
      expect(result.current.shortLabel).toBe("云端 DeepSeek");
      expect(result.current.topBarOk).toBe(true);
      expect(result.current.polishReadiness.ready).toBe(true);
    });
  });

  it("shares Ollama detect store between header and settings consumers", async () => {
    activateLocalOllamaPreset();
    ollamaDetectStatus.mockResolvedValue({
      reachable: false,
      modelCount: 0,
      hasQwen25_7b: false,
      message: "未连接",
    });

    const header = renderHook(() => useLlmEnvStatus(0));
    const settings = renderHook(() =>
      useLlmEnvStatus(0, { hasLocalKeyRef: true, hasTypedKey: false, keychainPresent: true }),
    );

    await waitFor(() => {
      expect(header.result.current.topBarOk).toBe(false);
      expect(settings.result.current.topBarOk).toBe(false);
    });

    ollamaDetectStatus.mockResolvedValue({
      reachable: true,
      modelCount: 1,
      hasQwen25_7b: true,
      hasConfiguredModel: true,
      message: "Ollama 就绪",
    });

    await act(async () => {
      await refreshLlmOllamaDetect();
    });

    await waitFor(() => {
      expect(header.result.current.shortLabel).toBe("本机 LLM");
      expect(settings.result.current.shortLabel).toBe("本机 LLM");
      expect(header.result.current.topBarOk).toBe(true);
      expect(settings.result.current.topBarOk).toBe(true);
    });
  });
});
