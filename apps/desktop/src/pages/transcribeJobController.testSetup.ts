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

/** Side-effect module: import first in transcribe job controller tests. */
export function transcribeJobTestApi() {
  return transcribeJobApiMocks;
}
