import { beforeEach, describe, expect, it, vi } from "vitest";
import { activateLocalOllamaPreset } from "./llmEnvStatus";
import {
  getLlmEnvRuntimeSnapshot,
  refreshLlmOllamaDetect,
  resetLlmEnvRuntimeStoreForTests,
  subscribeLlmEnvRuntime,
} from "./llmEnvRuntimeStore";

const ollamaDetectStatus = vi.fn<
  () => Promise<{
    reachable: boolean;
    modelCount: number;
    hasQwen25_7b: boolean;
    hasConfiguredModel?: boolean;
    message: string;
  }>
>();

vi.mock("../../tauri/postprocessApi", () => ({
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

describe("llmEnvRuntimeStore", () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.clear();
    resetLlmEnvRuntimeStoreForTests();
    ollamaDetectStatus.mockReset();
  });

  it("dedupes concurrent refresh calls", async () => {
    activateLocalOllamaPreset();
    ollamaDetectStatus.mockResolvedValue({
      reachable: true,
      modelCount: 1,
      hasQwen25_7b: true,
      hasConfiguredModel: true,
      message: "Ollama 就绪",
    });

    const [a, b] = await Promise.all([refreshLlmOllamaDetect(), refreshLlmOllamaDetect()]);

    expect(a.reachable).toBe(true);
    expect(b.reachable).toBe(true);
    expect(ollamaDetectStatus).toHaveBeenCalledTimes(1);
    expect(getLlmEnvRuntimeSnapshot().ollamaDetect?.message).toBe("Ollama 就绪");
  });

  it("notifies subscribers on detect update", async () => {
    activateLocalOllamaPreset();
    ollamaDetectStatus.mockResolvedValue({
      reachable: true,
      modelCount: 1,
      hasQwen25_7b: true,
      hasConfiguredModel: true,
      message: "Ollama 就绪",
    });

    let notifyCount = 0;
    const unsubscribe = subscribeLlmEnvRuntime(() => {
      notifyCount += 1;
    });

    await refreshLlmOllamaDetect();
    unsubscribe();

    expect(notifyCount).toBeGreaterThanOrEqual(2);
  });
});
