import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AsrSetupReport } from "../../services/asr/asrSetupContract";
import type { LocalRuntimeDiagnose } from "../../services/localRuntime/localRuntimeContract";
import type { AsrSetupControllerApi } from "../../pages/useAsrSetupController";
import { LocalAsrSetupWizard } from "./LocalAsrSetupWizard";

vi.mock("../../config/env", () => ({
  isTauriRuntime: () => true,
}));

function makeSetupReport(): AsrSetupReport {
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
  };
}

function makeLocalRuntimeDiag(): LocalRuntimeDiagnose {
  return {
    manifestConfigured: true,
    manifestStatus: "signature_invalid",
    manifestIssue: "当前 manifest 签名校验失败，已拒绝下载安装。",
    manifestSignatureKeyId: "rushi-runtime-release-v1",
    availableVersion: null,
    availableSizeBytes: null,
    requiredDiskBytes: null,
    freeDiskBytes: null,
    install: {
      phase: "idle",
      message: "",
      downloadedBytes: null,
      totalBytes: null,
      version: null,
      error: null,
    },
    installed: {
      status: "installed",
      version: "0.1.0",
      previousVersion: null,
      executablePath: "/tmp/local_runtime/asr-sidecar/0.1.0/rushi-asr-sidecar",
      rootDir: "/tmp/local_runtime/asr-sidecar",
      detail: null,
      lastVerifyError: null,
      lastInstallPhase: null,
    },
    blockingIssue: null,
  };
}

function makeSetup(): AsrSetupControllerApi {
  return {
    setupReport: makeSetupReport(),
    localRuntimeDiag: makeLocalRuntimeDiag(),
    setupSteps: [],
    setupBusy: false,
    diagnoseBusy: false,
    setupMessage: "",
    setupOutcome: "idle",
    portConflict: false,
    refreshSetupDiagnose: vi.fn(() => Promise.resolve(makeSetupReport())),
    refreshLocalRuntimeDiagnose: vi.fn(() => Promise.resolve(makeLocalRuntimeDiag())),
    downloadLocalRuntime: vi.fn(() => Promise.resolve()),
    cancelLocalRuntime: vi.fn(() => Promise.resolve()),
    revalidateLocalRuntime: vi.fn(() => Promise.resolve()),
    clearLocalRuntime: vi.fn(() => Promise.resolve()),
    restorePreviousLocalRuntime: vi.fn(() => Promise.resolve()),
    runOneClickAsrPrepare: vi.fn(() => Promise.resolve()),
    acceptForeignPortService: vi.fn(() => Promise.resolve()),
  };
}

describe("LocalAsrSetupWizard", () => {
  it("warns and disables downloads when the manifest is invalid but a runtime is still installed", () => {
    render(
      <LocalAsrSetupWizard
        setup={makeSetup()}
        busy={false}
        openAppDataFolder={vi.fn(() => Promise.resolve())}
        exportDiagnosticBundle={vi.fn(() => Promise.resolve())}
      />,
    );

    expect(
      screen.getByText("当前已安装版本仍可继续使用，但下载/升级已被阻止：当前 manifest 签名校验失败，已拒绝下载安装。"),
    ).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "下载 / 修复语音识别组件" }).disabled).toBe(true);
  });
});
