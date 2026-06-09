import { describe, expect, it, vi } from "vitest";
import { loadTranscribeVocabularyPreflight } from "./transcribeVocabularyPreflight";

vi.mock("../../tauri/glossaryApi", () => ({
  glossaryHotwordsPreview: vi.fn(async () => ({
    enabledEntryCount: 0,
    enabledEntries: [],
    truncated: false,
  })),
}));

vi.mock("../stt/sttOnlineProviderContract/bridge", () => ({
  isOnlineTranscribeReady: vi.fn(() => false),
}));

vi.mock("../stt/sttOnlineProviderContract/runtimeConfig", () => ({
  readExternalSttOnlineRuntimeConfigFromStorage: vi.fn(() => ({
    enabled: true,
    selectedProviderId: "dashscope-asr",
    timeoutMs: 30_000,
  })),
}));

vi.mock("../stt/sttOnlineProviderContract/storage", () => ({
  readStorage: vi.fn(() => null),
}));

describe("loadTranscribeVocabularyPreflight", () => {
  it("uses online vocabulary channel only when source is online and ready", async () => {
    const { isOnlineTranscribeReady } = await import("../stt/sttOnlineProviderContract/bridge");
    vi.mocked(isOnlineTranscribeReady).mockReturnValue(true);

    const online = await loadTranscribeVocabularyPreflight("online");
    expect(online.isOnlineMode).toBe(true);
    expect(online.onlineProviderId).toBe("dashscope-asr");

    vi.mocked(isOnlineTranscribeReady).mockReturnValue(false);
    const localDespitePayload = await loadTranscribeVocabularyPreflight("local");
    expect(localDespitePayload.isOnlineMode).toBe(false);
  });
});
