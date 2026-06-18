import { vi } from "vitest";

const transcribeJobApiMocks = vi.hoisted(() => ({
  projectRunTranscribe: vi.fn(),
  projectCancelTranscribe: vi.fn(),
  projectLoad: vi.fn(),
  projectTranscribeAsyncStart: vi.fn(),
  projectTranscribeAsyncFinalize: vi.fn(),
  getLastTranscribeTimeline: vi.fn(),
  recordTranscribeTimelinePollProgress: vi.fn(),
  recordTranscribeTimelinePollFailure: vi.fn(),
}));

vi.mock("../tauri/projectApi", () => ({
  projectRunTranscribe: transcribeJobApiMocks.projectRunTranscribe,
  projectCancelTranscribe: transcribeJobApiMocks.projectCancelTranscribe,
  projectLoad: transcribeJobApiMocks.projectLoad,
  projectTranscribeAsyncStart: transcribeJobApiMocks.projectTranscribeAsyncStart,
  projectTranscribeAsyncFinalize: transcribeJobApiMocks.projectTranscribeAsyncFinalize,
  getLastTranscribeTimeline: transcribeJobApiMocks.getLastTranscribeTimeline,
  recordTranscribeTimelinePollProgress: transcribeJobApiMocks.recordTranscribeTimelinePollProgress,
  recordTranscribeTimelinePollFailure: transcribeJobApiMocks.recordTranscribeTimelinePollFailure,
}));

vi.mock("../services/shellCapabilities", () => ({
  readShellManagesBundledSidecarSync: () => false,
}));

vi.mock("../config/env", () => ({
  asrBaseUrl: () => "http://127.0.0.1:8741",
  isTauriRuntime: () => false,
}));

vi.mock("../services/asr/loopbackFetch", () => ({
  loopbackFetch: vi.fn(),
}));

vi.mock("../services/stt/sttOnlineProviderContract", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/stt/sttOnlineProviderContract")>();
  return {
    ...actual,
    isOnlineTranscribeReady: vi.fn(() => false),
    tryBuildOnlineTranscribeBridgePayload: vi.fn(() => null),
    ensureSttOnlineApiKeyForSession: vi.fn(() => Promise.resolve(true)),
    ensureSttOnlineApiSecretForSession: vi.fn(() => Promise.resolve(true)),
  };
});

vi.mock("../services/ui/toast", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
  pushTranscribeHintsToToast: vi.fn(),
  pushTranscribeResultToast: vi.fn(),
}));

vi.mock("../services/deliveryModeTranscribeToast", () => ({
  pushTranscribeDeliveryModeToast: vi.fn(),
}));

vi.mock("../services/onboarding/onboardingAutoSync", () => ({
  syncOnboardingTranscribe: vi.fn(),
  syncOnboardingAsrReady: vi.fn(),
  syncOnboardingProjectAudio: vi.fn(),
  syncOnboardingMetadata: vi.fn(),
  syncOnboardingExport: vi.fn(),
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
}));

/** Side-effect module: import first in transcribe job controller tests. */
export function transcribeJobTestApi() {
  return transcribeJobApiMocks;
}
