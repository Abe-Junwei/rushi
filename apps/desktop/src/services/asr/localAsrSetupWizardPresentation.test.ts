import { describe, expect, it } from "vitest";
import {
  buildDiskMetaLine,
  buildRuntimeInstallPresentation,
  buildRuntimeMaintenanceActions,
  computeRuntimeDownloadProgress,
  isExternalSidecarSatisfyingSetup,
} from "./localAsrSetupWizardPresentation";
import type { LocalRuntimeDiagnose } from "../localRuntime/localRuntimeContract";
import { DEFAULT_ASR_SUPERVISOR_SNAPSHOT } from "./asrSetupContract";

function makeDiag(overrides: Partial<LocalRuntimeDiagnose> = {}): LocalRuntimeDiagnose {
  return {
    manifestConfigured: true,
    manifestStatus: "ok",
    manifestIssue: null,
    manifestSignatureKeyId: null,
    availableVersion: "0.2.0",
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
      executablePath: "/tmp/rushi-asr-sidecar",
      rootDir: "/tmp",
      detail: null,
      lastVerifyError: null,
      lastInstallPhase: null,
    },
    blockingIssue: null,
    ...overrides,
  };
}

describe("localAsrSetupWizardPresentation", () => {
  it("buildDiskMetaLine formats available space", () => {
    expect(
      buildDiskMetaLine({
        portStatus: "rushi_asr",
        bundledAvailable: true,
        sidecarIntegrity: "ok",
        bundledLaunch: { attempted: false, success: false },
        supervisor: { ...DEFAULT_ASR_SUPERVISOR_SNAPSHOT },
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
        modelsRoot: "/tmp",
        diskFreeBytes: 10 * 1024 ** 3,
        diskLow: false,
        readyForTranscribe: true,
        summaryLines: [],
        blockingIssue: null,
      }),
    ).toContain("模型目录可用");
  });

  it("flags runtime panel attention when sidecar is missing", () => {
    const out = buildRuntimeInstallPresentation(
      makeDiag({
        installed: {
          status: "missing",
          version: null,
          previousVersion: null,
          executablePath: "",
          rootDir: "",
          detail: null,
          lastVerifyError: null,
          lastInstallPhase: null,
        },
      }),
    );
    expect(out.needsAttention).toBe(true);
    expect(out.shortStatus).toBe("未安装");
  });

  it("dedupes manifest blocker copy when sidecar is missing", () => {
    const manifestMsg = "未配置本机语音识别组件 manifest，无法应用内下载安装侧车。";
    const out = buildRuntimeInstallPresentation(
      makeDiag({
        manifestConfigured: false,
        manifestStatus: "missing",
        manifestIssue: manifestMsg,
        blockingIssue: manifestMsg,
        installed: {
          status: "missing",
          version: null,
          previousVersion: null,
          executablePath: "",
          rootDir: "",
          detail: null,
          lastVerifyError: null,
          lastInstallPhase: null,
        },
      }),
    );
    expect(out.statusLine).toBe("尚未安装 · 应用内下载不可用");
    expect(out.alertLine).toBe(manifestMsg);
    expect(out.statusLine).not.toBe(out.alertLine);
    expect(out.showDownloadAction).toBe(false);
    expect(out.shortStatus).toBe("应用内不可用");
    expect(out.supplementalLines.some((line) => line.includes("本机 ASR"))).toBe(true);
  });

  it("merges manifest alert into a single line", () => {
    const out = buildRuntimeInstallPresentation(
      makeDiag({
        manifestStatus: "signature_invalid",
        manifestIssue: "签名校验失败",
      }),
    );
    expect(out.alertLine).toContain("下载/升级已阻止");
    expect(out.needsAttention).toBe(true);
  });

  it("hides component maintenance when sidecar is missing", () => {
    const maintenance = buildRuntimeMaintenanceActions(
      makeDiag({
        installed: {
          status: "missing",
          version: null,
          previousVersion: null,
          executablePath: "",
          rootDir: "",
          detail: null,
          lastVerifyError: null,
          lastInstallPhase: null,
        },
      }),
      { wizardBusy: false, runtimeInstallRunning: false },
    );
    expect(maintenance.showComponentMaintenance).toBe(false);
    expect(maintenance.canRevalidate).toBe(false);
    expect(maintenance.canClear).toBe(false);
  });

  it("enables component maintenance for installed sidecar", () => {
    const maintenance = buildRuntimeMaintenanceActions(makeDiag(), {
      wizardBusy: false,
      runtimeInstallRunning: false,
    });
    expect(maintenance.showComponentMaintenance).toBe(true);
    expect(maintenance.canRevalidate).toBe(true);
    expect(maintenance.canClear).toBe(true);
  });

  it("computeRuntimeDownloadProgress shows byte ratio during download", () => {
    const progress = computeRuntimeDownloadProgress({
      phase: "downloading",
      message: "下载中",
      downloadedBytes: 512 * 1024 * 1024,
      totalBytes: 1024 * 1024 * 1024,
      version: "0.2.0",
      error: null,
    });
    expect(progress.showDownloadProgress).toBe(true);
    expect(progress.downloadProgressPercent).toBe(50);
    expect(progress.downloadProgressLabel).toContain("50%");
  });

  it("computeRuntimeDownloadProgress uses phase label when bytes unknown", () => {
    const progress = computeRuntimeDownloadProgress({
      phase: "verifying",
      message: "验证中",
      downloadedBytes: null,
      totalBytes: null,
      version: "0.2.0",
      error: null,
    });
    expect(progress.showDownloadProgress).toBe(true);
    expect(progress.downloadProgressLabel).toBe("验证中…");
  });

  it("buildRuntimeInstallPresentation includes download progress while installing", () => {
    const out = buildRuntimeInstallPresentation(
      makeDiag({
        install: {
          phase: "downloading",
          message: "正在下载…",
          downloadedBytes: 100,
          totalBytes: 200,
          version: "0.2.0",
          error: null,
        },
      }),
    );
    expect(out.showDownloadProgress).toBe(true);
    expect(out.downloadProgressPercent).toBe(50);
  });

  it("softens runtime panel when external sidecar already satisfies setup", () => {
    const out = buildRuntimeInstallPresentation(
      makeDiag({
        manifestConfigured: false,
        manifestStatus: "missing",
        manifestIssue: "未配置本机语音识别组件 manifest，无法应用内下载安装侧车。",
        installed: {
          status: "missing",
          version: null,
          previousVersion: null,
          executablePath: "",
          rootDir: "",
          detail: null,
          lastVerifyError: null,
          lastInstallPhase: null,
        },
      }),
      { externalSidecarReady: true },
    );
    expect(out.needsAttention).toBe(false);
    expect(out.shortStatus).toBe("使用当前侧车");
    expect(out.alertLine).toBeNull();
  });

  it("isExternalSidecarSatisfyingSetup ignores stale report.readyForTranscribe", () => {
    const report = {
      portStatus: "free" as const,
      bundledAvailable: false,
      sidecarIntegrity: "ok" as const,
      bundledLaunch: { attempted: false, success: false },
      supervisor: { ...DEFAULT_ASR_SUPERVISOR_SNAPSHOT },
      health: {
        healthReachable: true,
        ffmpegOk: true,
        funasrImportOk: true,
        funasrReady: true,
        funasrDefaultModelCached: true,
        funasrVadModelCached: true,
        funasrRequiredModelsCached: true,
        readyForTranscribe: true,
        selectedModelReady: false,
        transcriptionMode: "funasr",
      },
      modelsRoot: "/tmp",
      diskFreeBytes: null,
      diskLow: false,
      readyForTranscribe: true,
      summaryLines: [],
      blockingIssue: null,
    };
    expect(isExternalSidecarSatisfyingSetup(report, { selectedModelReady: false })).toBe(false);
    expect(isExternalSidecarSatisfyingSetup(report, { selectedModelReady: true })).toBe(true);
  });
});
