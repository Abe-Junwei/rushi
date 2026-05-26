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
  asrHealthUrl: () => "http://127.0.0.1:8741/health",
  isDefaultBundledAsrTarget: () => true,
  isTauriRuntime: () => true,
}));

vi.mock("../tauri/asrSetupApi", () => ({
  asrSetupDiagnose: () => asrSetupDiagnose(),
}));

vi.mock("../tauri/projectApi", () => ({
  retryBundledAsrSidecar: () => retryBundledAsrSidecar(),
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

describe("useAsrSetupController", () => {
  beforeEach(() => {
    asrSetupDiagnose.mockReset();
    retryBundledAsrSidecar.mockReset();
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
      json: async () => ({
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
});
