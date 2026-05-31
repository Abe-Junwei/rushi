import type { SegmentDto } from "../tauri/projectApi";
import type { useTranscribeJobController } from "./useTranscribeJobController";
import { loopbackFetch } from "../services/asr/loopbackFetch";
import { transcribeJobTestApi } from "./transcribeJobController.testSetup";
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
    projectLoad,
    projectTranscribeAsyncStart,
    projectTranscribeAsyncFinalize,
  } = transcribeJobTestApi();

  projectRunTranscribe.mockReset();
  projectLoad.mockReset();
  projectTranscribeAsyncStart.mockReset();
  projectTranscribeAsyncFinalize.mockReset();
  vi.mocked(loopbackFetch).mockReset();

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
