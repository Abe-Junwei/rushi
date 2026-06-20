import { describe, expect, it } from "vitest";
import { outcomeFromReport, stepsFromReport } from "./asrSetupState";
import {
  DEFAULT_ASR_SUPERVISOR_SNAPSHOT,
  type AsrSetupReport,
} from "../services/asr/asrSetupContract";

function makeReport(overrides: Partial<AsrSetupReport> = {}): AsrSetupReport {
  return {
    portStatus: "rushi_asr",
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

describe("outcomeFromReport", () => {
  it("returns error for corrupt or unhealthy reports without a blocking issue", () => {
    expect(outcomeFromReport(makeReport({ sidecarIntegrity: "corrupt" }))).toBe("error");
    expect(
      outcomeFromReport(
        makeReport({
          health: {
            healthReachable: true,
            ffmpegOk: true,
            funasrImportOk: true,
            funasrReady: false,
            funasrDefaultModelCached: false,
            funasrVadModelCached: false,
            funasrRequiredModelsCached: false,
            readyForTranscribe: false,
            transcriptionMode: "stub",
          },
        }),
      ),
    ).toBe("error");
  });
});

describe("stepsFromReport", () => {
  it("marks recoverable foreign port as pending when bundled sidecar exists", () => {
    const steps = stepsFromReport(
      makeReport({
        portStatus: "foreign",
        portDetail: "8741 已有服务监听，但未能按 rushi-asr /health 响应",
        bundledAvailable: true,
        blockingIssue: null,
      }),
    );
    expect(steps.find((step) => step.id === "sidecar")).toMatchObject({
      status: "pending",
    });
  });

  it("marks recoverable foreign port as pending when blockingIssue is null", () => {
    const steps = stepsFromReport(
      makeReport({
        portStatus: "foreign",
        bundledAvailable: false,
        sidecarIntegrity: "unknown",
        blockingIssue: null,
      }),
    );
    expect(steps.find((step) => step.id === "sidecar")).toMatchObject({
      status: "pending",
    });
  });

  it("marks blocking foreign port as error", () => {
    const steps = stepsFromReport(
      makeReport({
        portStatus: "foreign",
        bundledAvailable: false,
        blockingIssue: "8741 已被其他程序占用。",
      }),
    );
    expect(steps.find((step) => step.id === "sidecar")).toMatchObject({
      status: "error",
    });
  });

  it("uses 'connected' wording for reachable sidecar instead of 'ready'", () => {
    const steps = stepsFromReport(
      makeReport({
        portStatus: "rushi_asr",
        bundledAvailable: true,
        health: {
          healthReachable: true,
          ffmpegOk: true,
          funasrImportOk: true,
          funasrReady: true,
          funasrDefaultModelCached: false,
          funasrVadModelCached: false,
          funasrRequiredModelsCached: false,
          readyForTranscribe: false,
          transcriptionMode: "funasr",
        },
      }),
    );
    expect(steps.find((step) => step.id === "sidecar")?.detail).toBe("侧车进程已连接");
  });

  it("uses 'connected' wording for external ASR service instead of 'ready'", () => {
    const steps = stepsFromReport(
      makeReport({
        portStatus: "rushi_asr",
        bundledAvailable: false,
        health: {
          healthReachable: true,
          ffmpegOk: true,
          funasrImportOk: true,
          funasrReady: true,
          funasrDefaultModelCached: false,
          funasrVadModelCached: false,
          funasrRequiredModelsCached: false,
          readyForTranscribe: false,
          transcriptionMode: "funasr",
        },
      }),
    );
    expect(steps.find((step) => step.id === "sidecar")?.detail).toBe("ASR 服务已连接");
  });

  it("keeps model step running while prepare is in flight", () => {
    const steps = stepsFromReport(
      makeReport({
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
        readyForTranscribe: true,
      }),
      { prepareModelBusy: true, prepareModelProgress: 42 },
    );
    expect(steps.find((step) => step.id === "model")).toMatchObject({
      status: "running",
      detail: "正在下载模型（42%）",
    });
    expect(steps.find((step) => step.id === "done")?.status).not.toBe("ok");
  });
});
