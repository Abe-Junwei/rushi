import "./useAsrSetupController.test.shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAsrSetupController } from "./useAsrSetupController";
import {
  asrSetupDiagnose,
  fetchMock,
  getLocalAsrHubModelPref,
  localRuntimeDiagnose,
  localRuntimeDownloadSidecar,
  loopbackHealthResponse,
  makeLocalRuntimeDiag,
  makeReport,
  mockBundledCopyPresentationSync,
  renderSetupController,
  resetAsrSetupControllerTestMocks,
  retryBundledAsrSidecar,
  setLocalAsrHubModelPref,
} from "./useAsrSetupController.test.shared";

describe("useAsrSetupController one-click prepare", () => {
  beforeEach(() => {
    resetAsrSetupControllerTestMocks();
  });

  it("short-circuits one-click prepare when UI and loopback agree transcribe-ready", async () => {
    asrSetupDiagnose.mockResolvedValue(makeReport());
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "ok",
          service: "rushi-asr",
          ffmpeg_ok: true,
          funasr_import_ok: true,
          funasr_model_configured: true,
          funasr_default_model_cached: true,
          funasr_vad_model_cached: true,
          funasr_required_models_cached: true,
          funasr_active_model_cached: true,
          funasr_ready: true,
          ready_for_transcribe: true,
          transcription_mode: "funasr",
          funasr_model_id: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
          funasr_language: "zh",
        }),
    } as Response);

    const prepareDefaultFunasrModel = vi.fn(async () => {});
    const { result } = renderSetupController({ prepareDefaultFunasrModel });

    await act(async () => {
      await result.current.runOneClickAsrPrepare();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("ready");
    });
    expect(retryBundledAsrSidecar).not.toHaveBeenCalled();
    expect(setLocalAsrHubModelPref).toHaveBeenCalledWith("iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch", {
      restartSidecar: false,
    });
    expect(prepareDefaultFunasrModel).not.toHaveBeenCalled();
    expect(result.current.setupMessage).toContain("无需重复准备");
  });

  it("short-circuits when UI selection matches sidecar even if Tauri pref differs", async () => {
    getLocalAsrHubModelPref.mockResolvedValue(
      "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    );
    asrSetupDiagnose.mockResolvedValue(
      makeReport({
        readyForTranscribe: false,
        blockingIssue: "当前所选模型缓存未完整完成，请继续执行一键准备或重新下载模型。",
      }),
    );
    fetchMock.mockResolvedValue(loopbackHealthResponse(true));

    const { result } = renderSetupController({
      selectedHubModelId: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
    });

    await act(async () => {
      await result.current.runOneClickAsrPrepare();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("ready");
    });
    expect(retryBundledAsrSidecar).not.toHaveBeenCalled();
    expect(setLocalAsrHubModelPref).toHaveBeenCalledWith("iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch", {
      restartSidecar: false,
    });
    expect(result.current.setupMessage).toContain("无需重复准备");
  });

  it("blocks one-click install when the runtime manifest is rejected", async () => {
    asrSetupDiagnose.mockResolvedValue(
      makeReport({
        bundledAvailable: false,
        portStatus: "free",
        readyForTranscribe: false,
        blockingIssue: "无可用侧车且 ASR 未连通。",
        summaryLines: ["8741 端口空闲，可启动内置推理侧车。"],
        health: {
          healthReachable: false,
          ffmpegOk: false,
          funasrImportOk: false,
          funasrReady: false,
          funasrDefaultModelCached: false,
          funasrVadModelCached: false,
          funasrRequiredModelsCached: false,
          readyForTranscribe: false,
          selectedModelReady: false,
          transcriptionMode: "stub",
        },
      }),
    );
    localRuntimeDiagnose.mockResolvedValue(
      makeLocalRuntimeDiag({
        manifestConfigured: true,
        manifestStatus: "signature_invalid",
        manifestIssue: "当前 manifest 签名校验失败，已拒绝下载安装。",
      }),
    );

    const { result } = renderHook(() =>
      useAsrSetupController({
        refreshAsrHealth: vi.fn(async () => {}),
        refreshAsrRuntimeInfo: vi.fn(async () => {}),
        prepareDefaultFunasrModel: vi.fn(async () => {}),
        bundledCopyPresentationSync: mockBundledCopyPresentationSync(),
        getSetupSelection: () => ({
          selectedHubModelId: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
          catalogStatus: null,
        }),
      }),
    );

    await act(async () => {
      await result.current.runOneClickAsrPrepare();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("blocked");
    });
    expect(result.current.setupMessage).toContain("签名校验失败");
    expect(localRuntimeDownloadSidecar).not.toHaveBeenCalled();
  });

  it("retries bundled sidecar when integrity is corrupt and manifest install is blocked", async () => {
    asrSetupDiagnose.mockResolvedValue(
      makeReport({
        bundledAvailable: true,
        sidecarIntegrity: "corrupt",
        portStatus: "rushi_asr",
        readyForTranscribe: false,
        blockingIssue: "内置侧车包可能损坏",
        health: {
          healthReachable: true,
          ffmpegOk: true,
          funasrImportOk: false,
          funasrReady: false,
          funasrDefaultModelCached: false,
          funasrVadModelCached: false,
          funasrRequiredModelsCached: false,
          readyForTranscribe: false,
          selectedModelReady: false,
          transcriptionMode: "funasr",
        },
      }),
    );
    localRuntimeDiagnose.mockResolvedValue(
      makeLocalRuntimeDiag({
        manifestConfigured: true,
        manifestStatus: "signature_invalid",
        manifestIssue: "当前 manifest 签名校验失败，已拒绝下载安装。",
      }),
    );
    fetchMock
      .mockResolvedValueOnce(loopbackHealthResponse(false))
      .mockResolvedValueOnce(loopbackHealthResponse(false))
      .mockResolvedValueOnce(loopbackHealthResponse(false))
      .mockResolvedValue(loopbackHealthResponse(true));

    const prepareDefaultFunasrModel = vi.fn(async () => {});
    const { result } = renderSetupController({ prepareDefaultFunasrModel });

    await act(async () => {
      await result.current.runOneClickAsrPrepare();
    });

    expect(retryBundledAsrSidecar).toHaveBeenCalled();
    expect(localRuntimeDownloadSidecar).not.toHaveBeenCalled();
    expect(result.current.setupOutcome).not.toBe("blocked");
  });
});

