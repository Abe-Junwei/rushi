import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyLlmProviderPreset,
  markLlmConnectionVerified,
  persistLlmRuntimeConfig,
} from "./postprocessRuntimeContract";
import { tryBuildPostprocessRuntimeBridge } from "./llmRuntimeStorage";
import { ensureStageBLlmActionReady, resolveStageBSyncBlockReason } from "./stageBLlmGate";

const llmHasStoredApiKey = vi.fn<(args: { apiKeyId: string }) => Promise<boolean>>();

vi.mock("../../tauri/postprocessApi", () => ({
  llmHasStoredApiKey: (args: { apiKeyId: string }) => llmHasStoredApiKey(args),
}));

vi.mock("./llmRuntimeStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./llmRuntimeStorage")>();
  return {
    ...actual,
    tryBuildPostprocessRuntimeBridge: vi.fn(actual.tryBuildPostprocessRuntimeBridge),
  };
});

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

describe("stageBLlmGate", () => {
  beforeEach(async () => {
    installMockLocalStorage();
    localStorage.clear();
    llmHasStoredApiKey.mockReset();
    llmHasStoredApiKey.mockResolvedValue(true);
    const actual = await vi.importActual<typeof import("./llmRuntimeStorage")>("./llmRuntimeStorage");
    vi.mocked(tryBuildPostprocessRuntimeBridge).mockImplementation(actual.tryBuildPostprocessRuntimeBridge);
  });

  it("resolveStageBSyncBlockReason blocks cloud when connection not verified", () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: "default" });
    const reason = resolveStageBSyncBlockReason({
      currentFileId: "file-1",
      hasSegmentText: true,
    });
    expect(reason).toContain("探测");
  });

  it("ensureStageBLlmActionReady passes when cloud keychain has key", async () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: "default" });
    markLlmConnectionVerified();
    llmHasStoredApiKey.mockResolvedValue(true);

    await expect(
      ensureStageBLlmActionReady({ currentFileId: "file-1", hasSegmentText: true }),
    ).resolves.toBeNull();
    expect(llmHasStoredApiKey).toHaveBeenCalledWith({ apiKeyId: "default" });
  });

  it("ensureStageBLlmActionReady blocks when keychain missing stored key", async () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: "default" });
    markLlmConnectionVerified();
    llmHasStoredApiKey.mockResolvedValue(false);

    await expect(
      ensureStageBLlmActionReady({ currentFileId: "file-1", hasSegmentText: true }),
    ).resolves.toContain("本地未找到");
  });

  it("ensureStageBLlmActionReady blocks when runtime bridge cannot be built", async () => {
    persistLlmRuntimeConfig({ ...applyLlmProviderPreset("deepseek"), apiKeyId: "default" });
    markLlmConnectionVerified();
    llmHasStoredApiKey.mockResolvedValue(true);
    vi.mocked(tryBuildPostprocessRuntimeBridge).mockReturnValue(null);

    await expect(
      ensureStageBLlmActionReady({ currentFileId: "file-1", hasSegmentText: true }),
    ).resolves.toContain("LLM");
  });
});
