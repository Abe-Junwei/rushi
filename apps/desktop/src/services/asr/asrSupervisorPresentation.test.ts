import { describe, expect, it } from "vitest";
import {
  DEFAULT_ASR_SUPERVISOR_SNAPSHOT,
  type AsrSetupReport,
} from "./asrSetupContract";
import {
  formatSupervisorPhaseLabel,
  launchReportFromSupervisor,
  sidecarStepFromSupervisor,
} from "./asrSupervisorPresentation";

function makeReport(overrides: Partial<AsrSetupReport> = {}): AsrSetupReport {
  return {
    portStatus: "free",
    bundledAvailable: true,
    sidecarIntegrity: "ok",
    bundledLaunch: { attempted: false, success: false },
    supervisor: { ...DEFAULT_ASR_SUPERVISOR_SNAPSHOT },
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
    modelsRoot: "/tmp/models",
    diskFreeBytes: null,
    diskLow: false,
    readyForTranscribe: false,
    summaryLines: [],
    blockingIssue: null,
    ...overrides,
  };
}

describe("launchReportFromSupervisor", () => {
  it("projects ready as successful attempt", () => {
    expect(
      launchReportFromSupervisor({
        ...DEFAULT_ASR_SUPERVISOR_SNAPSHOT,
        phase: "ready",
      }),
    ).toEqual({ attempted: true, success: true, detail: null });
  });

  it("maps lastErrorCode to launch detail", () => {
    const report = launchReportFromSupervisor({
      ...DEFAULT_ASR_SUPERVISOR_SNAPSHOT,
      phase: "stopped",
      lastErrorCode: "spawn_failed",
    });
    expect(report.attempted).toBe(false);
    expect(report.success).toBe(false);
    expect(report.detail).toContain("无法启动内置侧车");
  });
});

describe("sidecarStepFromSupervisor", () => {
  it("labels idle bundled sidecar as not started", () => {
    expect(sidecarStepFromSupervisor(makeReport())).toEqual({
      status: "pending",
      detail: "侧车未启动",
    });
  });

  it("uses running label while spawning", () => {
    expect(
      sidecarStepFromSupervisor(
        makeReport({
          supervisor: { ...DEFAULT_ASR_SUPERVISOR_SNAPSHOT, phase: "spawning" },
        }),
      ),
    ).toEqual({ status: "running", detail: "正在启动侧车" });
  });

  it("prefers foreign port over idle phase", () => {
    expect(
      sidecarStepFromSupervisor(
        makeReport({
          portStatus: "foreign",
          blockingIssue: "conflict",
          portDetail: "8741 被占用",
        }),
      ),
    ).toEqual({ status: "error", detail: "8741 被占用" });
  });
});

describe("formatSupervisorPhaseLabel", () => {
  it("covers ready", () => {
    expect(formatSupervisorPhaseLabel("ready")).toBe("侧车已就绪");
  });
});
