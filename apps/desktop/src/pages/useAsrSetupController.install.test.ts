import "./useAsrSetupController.test.shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAsrSetupController } from "./useAsrSetupController";
import {
  asrSetupDiagnose,
  fetchMock,
  localRuntimeDiagnose,
  localRuntimeDownloadSidecar,
  loopbackHealthResponse,
  makeLocalRuntimeDiag,
  makeReport,
  resetAsrSetupControllerTestMocks,
  retryBundledAsrSidecar,
  setLocalAsrHubModelPref,
} from "./useAsrSetupController.test.shared";

describe("useAsrSetupController install path", () => {
  beforeEach(() => {
    resetAsrSetupControllerTestMocks();
  });

  it("auto-installs local runtime before retrying sidecar when bundled runtime is missing", async () => {
    asrSetupDiagnose
      .mockResolvedValueOnce(
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
            transcriptionMode: "stub",
          },
        }),
      )
      .mockResolvedValue(
        makeReport({
          bundledAvailable: false,
          portStatus: "rushi_asr",
          readyForTranscribe: true,
          blockingIssue: null,
          summaryLines: ["应用数据侧车已启动并响应 /health。"],
        }),
      );
    localRuntimeDiagnose
      .mockResolvedValueOnce(
        makeLocalRuntimeDiag({
          manifestConfigured: true,
          manifestStatus: "ok",
          availableVersion: "0.1.0",
        }),
      )
      .mockResolvedValue(
        makeLocalRuntimeDiag({
          manifestConfigured: true,
          manifestStatus: "ok",
          availableVersion: "0.1.0",
          installed: {
            status: "installed",
            version: "0.1.0",
            executablePath: "/tmp/local_runtime/asr-sidecar/0.1.0/rushi-asr-sidecar",
            rootDir: "/tmp/local_runtime/asr-sidecar",
            detail: null,
          },
        }),
      );
    fetchMock
      .mockResolvedValueOnce(loopbackHealthResponse(false))
      .mockResolvedValueOnce(loopbackHealthResponse(false))
      .mockResolvedValueOnce(loopbackHealthResponse(false))
      .mockResolvedValue(loopbackHealthResponse(true));

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
      await result.current.runOneClickAsrPrepare();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("ready");
    });
    expect(localRuntimeDownloadSidecar).toHaveBeenCalledTimes(1);
    expect(setLocalAsrHubModelPref).toHaveBeenCalledWith("iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch", {
      restartSidecar: false,
    });
    expect(result.current.setupMessage).toContain("一键准备完成");
  });

  it("retries the bundled sidecar when bundled resources exist but health is still unreachable", async () => {
    asrSetupDiagnose
      .mockResolvedValueOnce(
        makeReport({
          bundledAvailable: true,
          portStatus: "free",
          readyForTranscribe: false,
          blockingIssue: "尚未连通 rushi-asr /health。",
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
            transcriptionMode: "stub",
          },
        }),
      )
      .mockResolvedValue(
        makeReport({
          bundledAvailable: true,
          portStatus: "rushi_asr",
          readyForTranscribe: true,
          blockingIssue: null,
          summaryLines: ["本机 rushi-asr 已在 8741 响应 /health。"],
        }),
      );
    fetchMock
      .mockResolvedValueOnce(loopbackHealthResponse(false))
      .mockResolvedValueOnce(loopbackHealthResponse(false))
      .mockResolvedValueOnce(loopbackHealthResponse(false))
      .mockResolvedValue(loopbackHealthResponse(true));

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
      await result.current.runOneClickAsrPrepare();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("ready");
    });
    expect(retryBundledAsrSidecar).toHaveBeenCalledTimes(1);
    expect(result.current.setupMessage).toContain("一键准备完成");
  });

  it("accepts a ready foreign rushi-asr service and clears the conflict path", async () => {
    asrSetupDiagnose
      .mockResolvedValueOnce(
        makeReport({
          portStatus: "foreign",
          portDetail: "8741 已被其他 rushi-asr 占用。",
          bundledAvailable: true,
          readyForTranscribe: false,
          blockingIssue: "8741 已被其他程序占用。",
          summaryLines: ["8741 已被其他程序占用。"],
          health: {
            healthReachable: false,
            ffmpegOk: false,
            funasrImportOk: false,
            funasrReady: false,
            funasrDefaultModelCached: false,
            funasrVadModelCached: false,
            funasrRequiredModelsCached: false,
            readyForTranscribe: false,
            transcriptionMode: "stub",
          },
        }),
      )
      .mockResolvedValue(
        makeReport({
          portStatus: "foreign",
          portDetail: "8741 已被其他 rushi-asr 占用。",
          bundledAvailable: true,
          readyForTranscribe: true,
          blockingIssue: null,
          summaryLines: ["本机 rushi-asr 已在 8741 响应 /health。"],
        }),
      );
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
    expect(result.current.portConflict).toBe(true);

    await act(async () => {
      await result.current.acceptForeignPortService();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("ready");
    });
    expect(result.current.setupMessage).toMatch(/8741 服务/);
    expect(result.current.portConflict).toBe(false);
  });
});

