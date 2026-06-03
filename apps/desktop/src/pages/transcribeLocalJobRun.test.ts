import "./transcribeJobController.testSetup";
import {
  loopbackFetch,
  resetTranscribeJobControllerTests,
  TRANSCRIBE_TEST_ASR_BASE,
  transcribeJobTestApi,
  transcribeTestSeg,
} from "./transcribeJobController.testHelpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { runLocalTranscribeJob } from "./transcribeLocalJobRun";
import { TranscribeUserCancelledError } from "./transcribePreviewState";

const {
  projectTranscribeAsyncStart,
  projectTranscribeAsyncFinalize,
  projectRunTranscribe,
} = transcribeJobTestApi();

describe("runLocalTranscribeJob", () => {
  beforeEach(() => {
    resetTranscribeJobControllerTests();
  });

  it("merges preview deltas during poll", async () => {
    let pollCount = 0;
    vi.mocked(loopbackFetch).mockImplementation(() => {
      pollCount += 1;
      if (pollCount === 1) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              phase: "transcribing",
              window_index: 1,
              window_count: 2,
              segments_delta: [{ start_sec: 0, end_sec: 1, text: "delta", kind: "speech" }],
              segments_total: 1,
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ phase: "done" }), { status: 200 }));
    });

    const segmentsRef = { current: [] as SegmentDto[] };
    const setSegments = vi.fn((rows: SegmentDto[]) => {
      segmentsRef.current = rows;
    });
    const setTranscribeProgress = vi.fn();
    const refs = {
      activeJobId: { current: null as string | null },
      userCancelRequested: { current: false },
      transcribeStartedAtMs: { current: Date.now() },
      firstSegmentsLogged: { current: false },
      pollAbort: { current: null as AbortController | null },
    };

    const out = await runLocalTranscribeJob({
      fileId: "file-1",
      base: TRANSCRIBE_TEST_ASR_BASE,
      segmentsRef,
      refs,
      callbacks: { setSegments, setTranscribeProgress },
    });

    expect(out.usedAsyncFallback).toBe(false);
    expect(setSegments).toHaveBeenCalled();
    expect(segmentsRef.current.some((s) => s.text === "delta")).toBe(true);
    expect(projectTranscribeAsyncFinalize).toHaveBeenCalled();
  });

  it("falls back to blocking when async routes are missing", async () => {
    projectTranscribeAsyncStart.mockRejectedValue(
      new Error('ASR HTTP 404 Not Found: {"detail":"Not Found"}'),
    );
    projectRunTranscribe.mockResolvedValue({
      engine: "funasr",
      warnings: [],
      detail: { segments: [transcribeTestSeg("blocking")] },
    });

    const segmentsRef = { current: [] as SegmentDto[] };
    const refs = {
      activeJobId: { current: null as string | null },
      userCancelRequested: { current: false },
      transcribeStartedAtMs: { current: Date.now() },
      firstSegmentsLogged: { current: false },
      pollAbort: { current: null as AbortController | null },
    };

    const out = await runLocalTranscribeJob({
      fileId: "file-1",
      base: TRANSCRIBE_TEST_ASR_BASE,
      segmentsRef,
      refs,
      callbacks: { setSegments: vi.fn(), setTranscribeProgress: vi.fn() },
    });

    expect(out.usedAsyncFallback).toBe(true);
    expect(projectRunTranscribe).toHaveBeenCalled();
    expect(projectTranscribeAsyncFinalize).not.toHaveBeenCalled();
  });

  it("does not fall back to blocking when user cancelled during async-unavailable", async () => {
    projectTranscribeAsyncStart.mockRejectedValue(
      new Error('ASR HTTP 404 Not Found: {"detail":"Not Found"}'),
    );

    const refs = {
      activeJobId: { current: null as string | null },
      userCancelRequested: { current: true },
      transcribeStartedAtMs: { current: Date.now() },
      firstSegmentsLogged: { current: false },
      pollAbort: { current: null as AbortController | null },
    };

    await expect(
      runLocalTranscribeJob({
        fileId: "file-1",
        base: TRANSCRIBE_TEST_ASR_BASE,
        segmentsRef: { current: [] },
        refs,
        callbacks: { setSegments: vi.fn(), setTranscribeProgress: vi.fn() },
      }),
    ).rejects.toBeInstanceOf(TranscribeUserCancelledError);
    expect(projectRunTranscribe).not.toHaveBeenCalled();
  });
});
