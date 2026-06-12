import "./transcribeJobController.testSetup";
import type { Dispatch, SetStateAction } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  baseTranscribeJobDeps,
  loopbackFetch,
  resetTranscribeJobControllerTests,
  TRANSCRIBE_TEST_ASR_BASE,
  transcribeJobTestApi,
  transcribeTestSeg,
} from "./transcribeJobController.testHelpers";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushTranscribeDeliveryModeToast } from "../services/deliveryModeTranscribeToast";
import { pushTranscribeHintsToToast } from "../services/ui/toast";
import { useTranscribeJobController } from "./useTranscribeJobController";

const {
  projectTranscribeAsyncStart,
  projectTranscribeAsyncFinalize,
  projectRunTranscribe,
} = transcribeJobTestApi();

describe("useTranscribeJobController async paths", () => {
  beforeEach(() => {
    resetTranscribeJobControllerTests();
  });

  it("polls async job and merges preview deltas", async () => {
    let pollCount = 0;
    vi.mocked(loopbackFetch).mockImplementation(() => {
      pollCount += 1;
      if (pollCount === 1) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              phase: "transcribing",
              window_index: 1,
              window_count: 10,
              segments_delta: [{ start_sec: 0, end_sec: 1, text: "p1", kind: "speech" }],
              segments_total: 1,
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ phase: "done" }), { status: 200 }));
    });

    const deps = baseTranscribeJobDeps({ segments: [], segmentsRef: { current: [] } });
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });
    await act(async () => {
      await result.current.confirmTranscribeStart();
    });

    expect(projectTranscribeAsyncFinalize).toHaveBeenCalledWith(
      "file-1",
      "job-1",
      TRANSCRIBE_TEST_ASR_BASE,
    );
    expect(deps.setSegments).toHaveBeenCalled();
  });

  it("surfaces poll HTTP errors instead of spinning until timeout", async () => {
    vi.mocked(loopbackFetch).mockResolvedValue(
      new Response(JSON.stringify({ detail: "bad gateway" }), { status: 502 }),
    );

    const setError = vi.fn();
    const deps = baseTranscribeJobDeps({ segments: [], segmentsRef: { current: [] }, setError });
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });
    await act(async () => {
      await result.current.confirmTranscribeStart();
    });

    expect(setError).toHaveBeenCalledWith(expect.stringContaining("HTTP 502"));
    expect(projectTranscribeAsyncFinalize).not.toHaveBeenCalled();
  });

  it("falls back to blocking transcribe when async start returns 404", async () => {
    projectTranscribeAsyncStart.mockRejectedValue(
      new Error('ASR HTTP 404 Not Found: {"detail":"Not Found"}'),
    );
    projectRunTranscribe.mockResolvedValue({
      engine: "funasr",
      warnings: [],
      detail: { segments: [transcribeTestSeg("blocking")] },
    });

    const deps = baseTranscribeJobDeps({ segments: [], segmentsRef: { current: [] } });
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });
    await act(async () => {
      await result.current.confirmTranscribeStart();
    });

    expect(projectTranscribeAsyncStart).toHaveBeenCalled();
    expect(projectRunTranscribe).toHaveBeenCalledWith("file-1", TRANSCRIBE_TEST_ASR_BASE, null);
    expect(projectTranscribeAsyncFinalize).not.toHaveBeenCalled();
    expect(vi.mocked(pushTranscribeHintsToToast)).toHaveBeenCalledWith([
      expect.stringContaining("增量转写"),
    ]);
    expect(vi.mocked(pushTranscribeDeliveryModeToast)).toHaveBeenCalled();
    expect(vi.mocked(pushTranscribeDeliveryModeToast).mock.calls[0]?.[0]).toMatch(
      /转写完成：用时 .+，\d+ 条语段，[\d,]+ 字/,
    );
    expect(deps.setError).not.toHaveBeenCalledWith(expect.stringContaining("404"));
    expect(deps.setSegments).toHaveBeenCalledWith([
      expect.objectContaining({ text: "blocking" }),
    ]);
  });

  it("repaints transcribed segments when same file was cleared at transcribe start", async () => {
    projectTranscribeAsyncStart.mockRejectedValue(
      new Error('ASR HTTP 404 Not Found: {"detail":"Not Found"}'),
    );
    const fresh = transcribeTestSeg("百炼结果");
    projectRunTranscribe.mockResolvedValue({
      engine: "dashscope:fun-asr:file",
      warnings: [],
      detail: { segments: [fresh] },
    });
    const existing = transcribeTestSeg("转写前已有语段");
    const segmentsRef = { current: [existing] };
    const setSegments = vi.fn((segs: SetStateAction<SegmentDto[]>) => {
      segmentsRef.current =
        typeof segs === "function" ? segs(segmentsRef.current) : segs;
    }) as Dispatch<SetStateAction<SegmentDto[]>>;
    const onTranscribeSuccess = vi.fn();
    const deps = baseTranscribeJobDeps({
      segments: [existing],
      segmentsRef,
      setSegments,
      onTranscribeSuccess,
    });
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });
    await act(async () => {
      await result.current.confirmTranscribeStart();
    });

    expect(setSegments).toHaveBeenCalledWith([expect.objectContaining({ text: "百炼结果" })]);
    expect(onTranscribeSuccess).toHaveBeenCalled();
    expect(segmentsRef.current[0]?.text).toBe("百炼结果");
  });
});
