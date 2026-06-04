import { vi } from "vitest";

const transcribeJobApiMocks = vi.hoisted(() => ({
  projectRunTranscribe: vi.fn(),
  projectLoad: vi.fn(),
  projectTranscribeAsyncStart: vi.fn(),
  projectTranscribeAsyncFinalize: vi.fn(),
}));

vi.mock("../tauri/projectApi", () => ({
  projectRunTranscribe: transcribeJobApiMocks.projectRunTranscribe,
  projectLoad: transcribeJobApiMocks.projectLoad,
  projectTranscribeAsyncStart: transcribeJobApiMocks.projectTranscribeAsyncStart,
  projectTranscribeAsyncFinalize: transcribeJobApiMocks.projectTranscribeAsyncFinalize,
}));

vi.mock("../config/env", () => ({
  asrBaseUrl: () => "http://127.0.0.1:8741",
}));

vi.mock("../services/asr/loopbackFetch", () => ({
  loopbackFetch: vi.fn(),
}));

vi.mock("../services/stt/sttOnlineProviderContract", () => ({
  isSttOnlineEnabledButIncomplete: () => false,
  tryBuildOnlineTranscribeBridgePayload: () => null,
}));

vi.mock("../services/ui/toast", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
  pushTranscribeHintsToToast: vi.fn(),
}));

vi.mock("../services/asr/transcribeVocabularyPreflight", () => ({
  loadTranscribeVocabularyPreflight: vi.fn(() => Promise.resolve({
    hotwords: null,
    isOnlineMode: false,
    localSkuLabel: "Paraformer 长音频（推荐转写）",
    localHotwordNote: null,
    onlineProviderId: null,
    onlineChannel: "unsupported",
    onlineBiasLine: null,
    emptyGlossaryHint: null,
  })),
  formatTranscribeVocabularyPreflightLines: () => [],
  compactTranscribeVocabularyPreflightHint: () => null,
}));

/** Side-effect module: import first in transcribe job controller tests. */
export function transcribeJobTestApi() {
  return transcribeJobApiMocks;
}
