import "./useAsrSetupController.test.shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAsrSetupController } from "./useAsrSetupController";
import {
  asrSetupDiagnose,
  fetchMock,
  makeReport,
  resetAsrSetupControllerTestMocks,
} from "./useAsrSetupController.test.shared";

describe("useAsrSetupController diagnose", () => {
  beforeEach(() => {
    resetAsrSetupControllerTestMocks();
  });

  it("maps partial auxiliary model cache into blocked wizard state", async () => {
    asrSetupDiagnose.mockResolvedValue(
      makeReport({
        readyForTranscribe: false,
        blockingIssue: "当前所选模型缓存未完整完成，请继续执行一键准备或重新下载模型。",
        health: {
          healthReachable: true,
          ffmpegOk: true,
          funasrImportOk: true,
          funasrReady: true,
          funasrDefaultModelCached: true,
          funasrVadModelCached: false,
          funasrRequiredModelsCached: false,
          readyForTranscribe: false,
          selectedModelReady: false,
          transcriptionMode: "stub",
        },
      }),
    );

    const { result } = renderHook(() =>
      useAsrSetupController({
        refreshAsrHealth: vi.fn(async () => {}),
        refreshAsrRuntimeInfo: vi.fn(async () => {}),
        prepareDefaultFunasrModel: vi.fn(async () => {}),
        getSetupSelection: () => ({
          selectedHubModelId: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
          catalogStatus: null,
        }),
      }),
    );

    await act(async () => {
      await result.current.refreshSetupDiagnose();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("blocked");
    });
    expect(result.current.setupSteps.find((step) => step.id === "model")?.detail).toContain("VAD");
  });

  it("rejects a foreign-port rushi-asr runtime that is still stub-only", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
        status: "ok",
        service: "rushi-asr",
        ffmpeg_ok: true,
        funasr_import_ok: true,
        funasr_model_configured: true,
        funasr_model_explicit_from_env: false,
        funasr_default_model_cached: false,
        funasr_vad_model_cached: false,
        funasr_required_models_cached: false,
        funasr_ready: false,
        ready_for_transcribe: false,
        transcription_mode: "stub",
        funasr_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
        rushi_models_root: "/tmp/models",
        }),
    } as Response);

    const refreshAsrHealth = vi.fn(async () => {});
    const { result } = renderHook(() =>
      useAsrSetupController({
        refreshAsrHealth,
        refreshAsrRuntimeInfo: vi.fn(async () => {}),
        prepareDefaultFunasrModel: vi.fn(async () => {}),
        getSetupSelection: () => ({
          selectedHubModelId: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
          catalogStatus: null,
        }),
      }),
    );

    await act(async () => {
      await result.current.acceptForeignPortService();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("blocked");
    });
    expect(refreshAsrHealth).toHaveBeenCalled();
    expect(result.current.setupMessage).toContain("FunASR 运行时尚未就绪");
  });

  it("coalesces parallel refreshSetupDiagnose into one Tauri call", async () => {
    asrSetupDiagnose.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve(
                makeReport({
                  readyForTranscribe: true,
                  health: {
                    healthReachable: true,
                    ffmpegOk: true,
                    funasrImportOk: true,
                    funasrReady: true,
                    funasrDefaultModelCached: true,
                    funasrVadModelCached: true,
                    funasrRequiredModelsCached: true,
                    readyForTranscribe: true,
                    selectedModelReady: true,
                    transcriptionMode: "funasr",
                  },
                }),
              ),
            30,
          );
        }),
    );

    const { result } = renderHook(() =>
      useAsrSetupController({
        refreshAsrHealth: vi.fn(async () => {}),
        refreshAsrRuntimeInfo: vi.fn(async () => {}),
        prepareDefaultFunasrModel: vi.fn(async () => {}),
        getSetupSelection: () => ({
          selectedHubModelId: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
          catalogStatus: null,
        }),
      }),
    );

    await act(async () => {
      await Promise.all([
        result.current.refreshSetupDiagnose({ resetSteps: false, touchUi: false }),
        result.current.refreshSetupDiagnose({ resetSteps: false, touchUi: false }),
      ]);
    });

    expect(asrSetupDiagnose).toHaveBeenCalledTimes(1);
  });
});

