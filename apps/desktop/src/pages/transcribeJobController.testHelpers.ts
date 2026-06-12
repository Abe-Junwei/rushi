import type { SegmentDto } from "../tauri/projectApi";
import type { useTranscribeJobController } from "./useTranscribeJobController";
import { loopbackFetch } from "../services/asr/loopbackFetch";
import { transcribeJobTestApi } from "./transcribeJobController.testSetup";
import * as sttContract from "../services/stt/sttOnlineProviderContract";
import { vi } from "vitest";

export const TRANSCRIBE_TEST_ASR_BASE = "http://127.0.0.1:8741";

export function transcribeTestSeg(text: string): SegmentDto {
  return {
    uid: "u1",
    idx: 0,
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
    kind: "speech",
  };
}

export function mockAsyncPollDone(): void {
  vi.mocked(loopbackFetch).mockResolvedValue(
    new Response(JSON.stringify({ phase: "done" }), { status: 200 }),
  );
}

export function baseTranscribeJobDeps(
  overrides: Partial<Parameters<typeof useTranscribeJobController>[0]> = {},
) {
  const segments = overrides.segments ?? [transcribeTestSeg("已有正文")];
  const segmentsRef = overrides.segmentsRef ?? { current: segments };
  return {
    busy: false,
    beginBusy: vi.fn(),
    endBusy: vi.fn(),
    current: { id: "proj-1", name: "P", files: [], created_at_ms: 0, updated_at_ms: 0 },
    currentFileId: "file-1",
    segments,
    segmentsRef,
    setCurrent: vi.fn(),
    setSegments: vi.fn(),
    setError: vi.fn(),
    closeGate: { openFileWrapped: vi.fn(async () => {}) },
    mutations: { resetMutationHistory: vi.fn() },
    localTranscribePreflight: () => null,
    ...overrides,
  };
}

export function resetTranscribeJobControllerTests(): void {
  const {
    projectRunTranscribe,
    projectCancelTranscribe,
    projectLoad,
    projectTranscribeAsyncStart,
    projectTranscribeAsyncFinalize,
    getLastTranscribeTimeline,
    recordTranscribeTimelinePollProgress,
    recordTranscribeTimelinePollFailure,
  } = transcribeJobTestApi();

  projectRunTranscribe.mockReset();
  projectCancelTranscribe.mockReset();
  projectLoad.mockReset();
  projectTranscribeAsyncStart.mockReset();
  projectTranscribeAsyncFinalize.mockReset();
  getLastTranscribeTimeline.mockReset();
  recordTranscribeTimelinePollProgress.mockReset();
  recordTranscribeTimelinePollFailure.mockReset();
  vi.mocked(loopbackFetch).mockReset();
  vi.mocked(sttContract.isOnlineTranscribeReady).mockReturnValue(false);
  vi.mocked(sttContract.tryBuildOnlineTranscribeBridgePayload).mockReturnValue(null);
  vi.mocked(sttContract.ensureSttOnlineApiKeyForSession).mockResolvedValue(true);

  projectCancelTranscribe.mockResolvedValue(true);
  getLastTranscribeTimeline.mockResolvedValue(null);
  recordTranscribeTimelinePollProgress.mockResolvedValue(undefined);
  recordTranscribeTimelinePollFailure.mockResolvedValue(undefined);
  projectTranscribeAsyncStart.mockResolvedValue({ jobId: "job-1" });
  projectTranscribeAsyncFinalize.mockResolvedValue({
    engine: "funasr",
    warnings: [],
    detail: { segments: [transcribeTestSeg("新语段")] },
  });
  projectLoad.mockResolvedValue({
    id: "proj-1",
    name: "P",
    files: [],
    created_at_ms: 0,
    updated_at_ms: 0,
  });
  mockAsyncPollDone();
}

export { loopbackFetch, transcribeJobTestApi };
