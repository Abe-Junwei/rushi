import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AsrSetupReport } from "../services/asr/asrSetupContract";
import type { LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";
import { useAsrSetupController } from "./useAsrSetupController";

const asrSetupDiagnose = vi.fn<() => Promise<AsrSetupReport>>();
const retryBundledAsrSidecar = vi.fn<() => Promise<void>>();
const localRuntimeDiagnose = vi.fn<() => Promise<LocalRuntimeDiagnose>>();
const localRuntimeDownloadSidecar = vi.fn<() => Promise<{ started: boolean; reason?: string | null }>>();
const localRuntimeCancelDownload = vi.fn<() => Promise<boolean>>();
const localRuntimeRevalidateInstall = vi.fn<() => Promise<{ ok: boolean; reason?: string | null }>>();
const localRuntimeClearInstall = vi.fn<() => Promise<{ ok: boolean; reason?: string | null }>>();
const localRuntimeRestorePrevious = vi.fn<() => Promise<{ ok: boolean; reason?: string | null }>>();
const fetchMock = vi.fn<typeof fetch>();

vi.mock("../config/env", () => ({
  asrBaseUrl: () => "http://127.0.0.1:8741",
  asrHealthUrl: () => "http://127.0.0.1:8741/health",
  isDefaultBundledAsrTarget: () => true,
  isTauriRuntime: () => true,
}));

vi.mock("../services/asr/loopbackFetch", () => ({
  loopbackFetch: vi.fn(async (url: string) => {
    const res = await fetch(url, { method: "GET" });
    return res;
  }),
}));

vi.mock("../tauri/asrSetupApi", () => ({
  asrSetupDiagnose: () => asrSetupDiagnose(),
}));

const setLocalAsrHubModelPref = vi.fn<
  (hub: string, options?: { restartSidecar?: boolean }) => Promise<void>
>();
const getLocalAsrHubModelPref = vi.fn<() => Promise<string | null>>();

vi.mock("../tauri/projectApi", () => ({
  retryBundledAsrSidecar: () => retryBundledAsrSidecar(),
  setLocalAsrHubModelPref: (hubModelId: string, options?: { restartSidecar?: boolean }) =>
    setLocalAsrHubModelPref(hubModelId, options),
  getLocalAsrHubModelPref: () => getLocalAsrHubModelPref(),
}));

vi.mock("../tauri/localRuntimeApi", () => ({
  localRuntimeDiagnose: () => localRuntimeDiagnose(),
  localRuntimeDownloadSidecar: () => localRuntimeDownloadSidecar(),
  localRuntimeCancelDownload: () => localRuntimeCancelDownload(),
  localRuntimeRevalidateInstall: () => localRuntimeRevalidateInstall(),
  localRuntimeClearInstall: () => localRuntimeClearInstall(),
  localRuntimeRestorePrevious: () => localRuntimeRestorePrevious(),
}));

function makeReport(overrides: Partial<AsrSetupReport> = {}): AsrSetupReport {
  return {
    portStatus: "rushi_asr",
    bundledAvailable: true,
    sidecarIntegrity: "ok",
    bundledLaunch: { attempted: false, success: false },
    health: {
      healthReachable: true,
      ffmpegOk: true,
      funasrImportOk: true,
      funasrReady: true,
      funasrDefaultModelCached: true,
      funasrVadModelCached: true,
      funasrRequiredModelsCached: true,
      readyForTranscribe: true,
      transcriptionMode: "funasr",
    },
    modelsRoot: "/tmp/models",
    diskFreeBytes: 10 * 1024 ** 3,
    diskLow: false,
    readyForTranscribe: true,
    summaryLines: ["本机 rushi-asr 已在 8741 响应 /health。"],
    blockingIssue: null,
    ...overrides,
  };
}

function loopbackHealthResponse(ready: boolean): Response {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        status: "ok",
        service: "rushi-asr",
        ffmpeg_ok: ready,
        funasr_import_ok: ready,
        funasr_model_configured: ready,
        funasr_default_model_cached: ready,
        funasr_vad_model_cached: ready,
        funasr_required_models_cached: ready,
        funasr_active_model_cached: ready,
        funasr_ready: ready,
        ready_for_transcribe: ready,
        transcription_mode: ready ? "funasr" : "stub",
        funasr_model_id: "iic/SenseVoiceSmall",
      }),
  } as Response;
}

function makeLocalRuntimeDiag(overrides: Partial<LocalRuntimeDiagnose> = {}): LocalRuntimeDiagnose {
  return {
    manifestConfigured: false,
    manifestStatus: "missing",
    availableVersion: null,
    install: {
      phase: "idle",
      message: "",
      downloadedBytes: null,
      totalBytes: null,
      version: null,
      error: null,
    },
    installed: {
      status: "missing",
      version: null,
      executablePath: null,
      rootDir: "/tmp/local_runtime/asr-sidecar",
      detail: null,
    },
    blockingIssue: null,
    ...overrides,
  };
}

function renderSetupController(overrides?: {
  prepareDefaultFunasrModel?: () => Promise<void>;
  selectedHubModelId?: string;
}) {
  return renderHook(() =>
    useAsrSetupController({
      refreshAsrHealth: vi.fn(async () => {}),
      refreshAsrRuntimeInfo: vi.fn(async () => {}),
      prepareDefaultFunasrModel: overrides?.prepareDefaultFunasrModel ?? vi.fn(async () => {}),
      getSetupSelection: () => ({
        selectedHubModelId: overrides?.selectedHubModelId ?? "iic/SenseVoiceSmall",
        catalogStatus: null,
      }),
    }),
  );
}

describe("useAsrSetupController", () => {
  beforeEach(() => {
    asrSetupDiagnose.mockReset();
    retryBundledAsrSidecar.mockReset();
    setLocalAsrHubModelPref.mockReset();
    getLocalAsrHubModelPref.mockReset();
    getLocalAsrHubModelPref.mockResolvedValue("iic/SenseVoiceSmall");
    setLocalAsrHubModelPref.mockResolvedValue(undefined);
    localRuntimeDiagnose.mockReset();
    localRuntimeDownloadSidecar.mockReset();
    localRuntimeCancelDownload.mockReset();
    localRuntimeRevalidateInstall.mockReset();
    localRuntimeClearInstall.mockReset();
    localRuntimeRestorePrevious.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    localRuntimeDiagnose.mockResolvedValue(makeLocalRuntimeDiag());
    localRuntimeDownloadSidecar.mockResolvedValue({ started: true });
    localRuntimeCancelDownload.mockResolvedValue(true);
    localRuntimeRevalidateInstall.mockResolvedValue({ ok: true });
    localRuntimeClearInstall.mockResolvedValue({ ok: true });
    localRuntimeRestorePrevious.mockResolvedValue({ ok: true });
  });

  it("maps partial auxiliary model cache into blocked wizard state", async () => {
    asrSetupDiagnose.mockResolvedValue(
      makeReport({
        readyForTranscribe: false,
        blockingIssue: "默认模型缓存未完整完成，请继续执行一键准备或重新下载模型。",
        health: {
          healthReachable: true,
          ffmpegOk: true,
          funasrImportOk: true,
          funasrReady: true,
          funasrDefaultModelCached: true,
          funasrVadModelCached: false,
          funasrRequiredModelsCached: false,
          readyForTranscribe: false,
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
          selectedHubModelId: "iic/SenseVoiceSmall",
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
        funasr_model_id: "iic/SenseVoiceSmall",
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
          selectedHubModelId: "iic/SenseVoiceSmall",
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
      .mockResolvedValue(loopbackHealthResponse(true));

    const { result } = renderHook(() =>
      useAsrSetupController({
        refreshAsrHealth: vi.fn(async () => {}),
        refreshAsrRuntimeInfo: vi.fn(async () => {}),
        prepareDefaultFunasrModel: vi.fn(async () => {}),
        getSetupSelection: () => ({
          selectedHubModelId: "iic/SenseVoiceSmall",
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
    expect(setLocalAsrHubModelPref).not.toHaveBeenCalled();
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
      .mockResolvedValue(loopbackHealthResponse(true));

    const { result } = renderHook(() =>
      useAsrSetupController({
        refreshAsrHealth: vi.fn(async () => {}),
        refreshAsrRuntimeInfo: vi.fn(async () => {}),
        prepareDefaultFunasrModel: vi.fn(async () => {}),
        getSetupSelection: () => ({
          selectedHubModelId: "iic/SenseVoiceSmall",
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
          funasr_model_id: "iic/SenseVoiceSmall",
        }),
    } as Response);

    const { result } = renderHook(() =>
      useAsrSetupController({
        refreshAsrHealth: vi.fn(async () => {}),
        refreshAsrRuntimeInfo: vi.fn(async () => {}),
        prepareDefaultFunasrModel: vi.fn(async () => {}),
        getSetupSelection: () => ({
          selectedHubModelId: "iic/SenseVoiceSmall",
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
          funasr_model_id: "iic/SenseVoiceSmall",
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
    expect(setLocalAsrHubModelPref).not.toHaveBeenCalled();
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
        blockingIssue: "默认模型缓存未完整完成，请继续执行一键准备或重新下载模型。",
      }),
    );
    fetchMock.mockResolvedValue(loopbackHealthResponse(true));

    const { result } = renderSetupController({
      selectedHubModelId: "iic/SenseVoiceSmall",
    });

    await act(async () => {
      await result.current.runOneClickAsrPrepare();
    });

    await waitFor(() => {
      expect(result.current.setupOutcome).toBe("ready");
    });
    expect(retryBundledAsrSidecar).not.toHaveBeenCalled();
    expect(setLocalAsrHubModelPref).toHaveBeenCalledWith("iic/SenseVoiceSmall", {
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
        getSetupSelection: () => ({
          selectedHubModelId: "iic/SenseVoiceSmall",
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
});
