import { describe, expect, it } from "vitest";
import {
  buildDiskMetaLine,
  buildRuntimeInstallPresentation,
} from "./localAsrSetupWizardPresentation";
import type { LocalRuntimeDiagnose } from "../localRuntime/localRuntimeContract";

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
});
