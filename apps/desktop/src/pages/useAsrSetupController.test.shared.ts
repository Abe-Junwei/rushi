import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import type { AsrSetupReport } from "../services/asr/asrSetupContract";
import type { LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";
import { useAsrSetupController } from "./useAsrSetupController";

export const asrSetupDiagnose = vi.fn<() => Promise<AsrSetupReport>>();
export const retryBundledAsrSidecar = vi.fn<() => Promise<void>>();
export const localRuntimeDiagnose = vi.fn<() => Promise<LocalRuntimeDiagnose>>();
export const localRuntimeDownloadSidecar = vi.fn<
  () => Promise<{ started: boolean; reason?: string | null }>
>();
export const localRuntimeCancelDownload = vi.fn<() => Promise<boolean>>();
export const localRuntimeRevalidateInstall = vi.fn<() => Promise<{ ok: boolean; reason?: string | null }>>();
export const localRuntimeClearInstall = vi.fn<() => Promise<{ ok: boolean; reason?: string | null }>>();
export const localRuntimeRestorePrevious = vi.fn<() => Promise<{ ok: boolean; reason?: string | null }>>();
export const fetchMock = vi.fn<typeof fetch>();

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

export const setLocalAsrHubModelPref = vi.fn<
  (hub: string, options?: { restartSidecar?: boolean }) => Promise<void>
>();
export const getLocalAsrHubModelPref = vi.fn<() => Promise<string | null>>();

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

export function makeReport(overrides: Partial<AsrSetupReport> = {}): AsrSetupReport {
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

export function loopbackHealthResponse(ready: boolean): Response {
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

export function makeLocalRuntimeDiag(overrides: Partial<LocalRuntimeDiagnose> = {}): LocalRuntimeDiagnose {
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

export function renderSetupController(overrides?: {
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

export function resetAsrSetupControllerTestMocks(): void {
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
}
