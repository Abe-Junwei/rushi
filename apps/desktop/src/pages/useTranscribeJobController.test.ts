import "./transcribeJobController.testSetup";
import {
  baseTranscribeJobDeps,
  resetTranscribeJobControllerTests,
  transcribeJobTestApi,
  transcribeTestSeg,
} from "./transcribeJobController.testHelpers";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pushTranscribeDeliveryModeToast } from "../services/deliveryModeTranscribeToast";
import { syncOnboardingTranscribe } from "../services/onboarding/onboardingAutoSync";
import { pushTranscribeHintsToToast } from "../services/ui/toast";
import { useTranscribeJobController } from "./useTranscribeJobController";

const { projectTranscribeAsyncStart, projectTranscribeAsyncFinalize, projectRunTranscribe } =
  transcribeJobTestApi();

describe("useTranscribeJobController", () => {
  beforeEach(() => {
    resetTranscribeJobControllerTests();
  });

  it("opens start dialog when segments have non-empty text", async () => {
    const deps = baseTranscribeJobDeps();
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });

    expect(result.current.transcribeStartDialogOpen).toBe(true);
    expect(result.current.transcribeStartHasExistingText).toBe(true);
    expect(projectTranscribeAsyncStart).not.toHaveBeenCalled();
  });

  it("blocks transcribe when local preflight returns a message on confirm", async () => {
    const setError = vi.fn();
    const deps = baseTranscribeJobDeps({
      segments: [],
      segmentsRef: { current: [] },
      setError,
      localTranscribePreflight: () => "本机 ASR 未就绪",
    });
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });
    expect(result.current.transcribeStartDialogOpen).toBe(true);

    await act(async () => {
      await result.current.confirmTranscribeStart();
    });

    expect(setError).toHaveBeenCalledWith("本机 ASR 未就绪");
    expect(projectTranscribeAsyncStart).not.toHaveBeenCalled();
  });

  it("runs async transcribe after confirm when segments are empty", async () => {
    const deps = baseTranscribeJobDeps({ segments: [], segmentsRef: { current: [] } });
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });
    expect(result.current.transcribeStartDialogOpen).toBe(true);

    await act(async () => {
      await result.current.confirmTranscribeStart();
    });

    expect(projectTranscribeAsyncStart).toHaveBeenCalled();
    expect(projectTranscribeAsyncFinalize).toHaveBeenCalled();
    expect(projectRunTranscribe).not.toHaveBeenCalled();
    expect(result.current.transcribeStartDialogOpen).toBe(false);
    expect(deps.beginBusy).toHaveBeenCalledWith("transcribe");
    expect(deps.endBusy).toHaveBeenCalled();
  });

  it("confirmTranscribeStart closes dialog before transcribe finishes", async () => {
    let resolveFinalize!: (value: unknown) => void;
    projectTranscribeAsyncFinalize.mockReturnValue(
      new Promise((resolve) => {
        resolveFinalize = resolve;
      }),
    );

    const deps = baseTranscribeJobDeps();
    const { result } = renderHook(() =>
      useTranscribeJobController(deps as Parameters<typeof useTranscribeJobController>[0]),
    );

    await act(async () => {
      await result.current.requestTranscribe();
    });
    expect(result.current.transcribeStartDialogOpen).toBe(true);

    act(() => {
      void result.current.confirmTranscribeStart();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(projectTranscribeAsyncStart).toHaveBeenCalled();
    expect(result.current.transcribeStartDialogOpen).toBe(false);

    await act(async () => {
      resolveFinalize({
        engine: "funasr",
        warnings: [],
        detail: { segments: [transcribeTestSeg("覆盖后")] },
      });
      await Promise.resolve();
    });
    expect(deps.endBusy).toHaveBeenCalled();
  });

  it("sets failure diag from last timeline when transcribe throws (TRN-DIAG)", async () => {
    const { projectTranscribeAsyncStart, projectRunTranscribe, getLastTranscribeTimeline } =
      transcribeJobTestApi();
    projectTranscribeAsyncStart.mockRejectedValue(
      new Error('ASR HTTP 404 Not Found: {"detail":"Not Found"}'),
    );
    projectRunTranscribe.mockRejectedValue(
      new Error("无法连接本机 ASR（127.0.0.1:8741 拒绝连接）"),
    );
    getLastTranscribeTimeline.mockResolvedValue({
      schemaVersion: 1,
      fileId: "file-1",
      source: "local",
      startedAtMs: 1,
      outcome: "failed",
      failedStage: "transcribe",
      errorCode: "sidecar_connect",
      suggestedAction: "侧车可能未启动或已崩溃；请到「环境 → 本机 ASR」重试内置侧车。",
      transcribeTimeline: [
        { stage: "preflight", startedAtMs: 1, endedAtMs: 2 },
        {
          stage: "transcribe",
          startedAtMs: 3,
          endedAtMs: 4,
          errorCode: "sidecar_connect",
        },
      ],
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

    expect(result.current.transcribeFailureDiag?.failedStage).toBe("transcribe");
    expect(result.current.transcribeFailureDiag?.errorCode).toBe("sidecar_connect");
    expect(deps.setError).toHaveBeenCalled();
  });

  it("treats zero-segment transcribe as failure with diag banner (not onboarding success)", async () => {
    projectTranscribeAsyncFinalize.mockResolvedValue({
      engine: "funasr+x",
      warnings: ["funasr_no_sentence_segments"],
      detail: { segments: [] },
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

    expect(vi.mocked(pushTranscribeDeliveryModeToast)).not.toHaveBeenCalled();
    expect(vi.mocked(syncOnboardingTranscribe)).not.toHaveBeenCalled();
    expect(vi.mocked(pushTranscribeHintsToToast)).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.stringContaining("未生成语段"),
        expect.stringContaining("未识别到可写入的文本"),
      ]),
    );
    expect(result.current.transcribeFailureDiag?.errorCode).toBe("transcribe_empty_output");
    expect(deps.setError).toHaveBeenCalledWith("转写未产出可用语段。");
    expect(result.current.transcribeHints.some((h) => h.includes("未识别到可写入的文本"))).toBe(
      true,
    );
  });

  it("treats stub engine with zero segments as stub failure diag", async () => {
    projectTranscribeAsyncFinalize.mockResolvedValue({
      engine: "stub",
      warnings: [],
      detail: { segments: [] },
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

    expect(result.current.transcribeFailureDiag?.errorCode).toBe("transcribe_stub_no_output");
    expect(deps.setError).toHaveBeenCalledWith("转写未产出可用语段。");
    expect(vi.mocked(syncOnboardingTranscribe)).not.toHaveBeenCalled();
  });
});
