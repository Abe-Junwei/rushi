import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLlmEnvStatus } from "./useLlmEnvStatus";
import {
  DEFAULT_LLM_API_KEY_ID,
  applyLlmProviderPreset,
  markLlmConnectionVerified,
  persistLlmRuntimeConfig,
} from "../services/postprocess/postprocessRuntimeContract";

const ollamaDetectStatus = vi.fn<
  () => Promise<{ reachable: boolean; modelCount: number; hasQwen25_7b: boolean; message: string }>
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
    ollamaDetectStatus.mockReset();
    ollamaDetectStatus.mockResolvedValue({
      reachable: true,
      modelCount: 1,
      hasQwen25_7b: true,
      message: "Ollama 就绪",
    });
  });

  it("updates top bar label after cloud connection verified event", async () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: DEFAULT_LLM_API_KEY_ID });

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
});
