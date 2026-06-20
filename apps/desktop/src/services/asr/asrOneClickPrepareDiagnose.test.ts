import { describe, expect, it, vi } from "vitest";
import type { AsrSetupReport } from "./asrSetupContract";
import { DEFAULT_ASR_SUPERVISOR_SNAPSHOT } from "./asrSetupContract";
import { runAsrOneClickPrepareDiagnose } from "./asrOneClickPrepareDiagnose";

function makeDeps() {
  return {
    refreshAsrHealth: vi.fn(async () => {}),
    refreshAsrRuntimeInfo: vi.fn(async () => {}),
    prepareDefaultFunasrModel: vi.fn(async () => {}),
    getSetupSelection: () => ({
      selectedHubModelId: "iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
      catalogStatus: null,
    }),
  };
}

function makeReport(overrides: Partial<AsrSetupReport> = {}): AsrSetupReport {
  return {
    portStatus: "rushi_asr",
    bundledAvailable: true,
    sidecarIntegrity: "ok",
    bundledLaunch: { attempted: false, success: false },
    supervisor: DEFAULT_ASR_SUPERVISOR_SNAPSHOT,
    health: {
      healthReachable: true,
      ffmpegOk: true,
      funasrImportOk: true,
      funasrReady: false,
      funasrDefaultModelCached: false,
      funasrVadModelCached: false,
      funasrRequiredModelsCached: false,
      readyForTranscribe: false,
      transcriptionMode: "funasr",
    },
    modelsRoot: "/tmp/models",
    diskFreeBytes: 10 * 1024 ** 3,
    diskLow: false,
    readyForTranscribe: false,
    summaryLines: ["8741 已被其他程序占用。"],
    blockingIssue: "8741 已被其他程序占用。",
    ...overrides,
  };
}

describe("runAsrOneClickPrepareDiagnose", () => {
  it("does not block when port probe says foreign but /health is reachable", async () => {
    const refreshSetupDiagnose = vi.fn(async () =>
      makeReport({
        portStatus: "foreign",
        portDetail: "8741 已有服务监听，但未能按 rushi-asr /health 响应",
        blockingIssue: null,
      }),
    );
    const setSetupSteps = vi.fn((updater: unknown) =>
      typeof updater === "function" ? (updater as (steps: unknown[]) => unknown[])([]) : updater,
    );
    const setSetupMessage = vi.fn();
    const setSetupOutcome = vi.fn();

    const ctx = await runAsrOneClickPrepareDiagnose(makeDeps(), {
      refreshSetupDiagnose,
      refreshLocalRuntimeDiagnose: vi.fn(async () => null),
      pollUntilHealth: vi.fn(async () => true),
      ensureLocalRuntimeInstalled: vi.fn(async () => true),
      setSetupSteps,
      setSetupMessage,
      setSetupOutcome,
    });

    expect(ctx).not.toBeNull();
    expect(setSetupOutcome).not.toHaveBeenCalledWith("blocked");
  });

  it("does not block foreign port while bundled sidecar is available (startup window)", async () => {
    const refreshSetupDiagnose = vi.fn(async () =>
      makeReport({
        bundledAvailable: true,
        portStatus: "foreign",
        blockingIssue: null,
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
    const setSetupSteps = vi.fn((updater: unknown) =>
      typeof updater === "function" ? (updater as (steps: unknown[]) => unknown[])([]) : updater,
    );

    const ctx = await runAsrOneClickPrepareDiagnose(makeDeps(), {
      refreshSetupDiagnose,
      refreshLocalRuntimeDiagnose: vi.fn(async () => null),
      pollUntilHealth: vi.fn(async () => true),
      ensureLocalRuntimeInstalled: vi.fn(async () => true),
      setSetupSteps,
      setSetupMessage: vi.fn(),
      setSetupOutcome: vi.fn(),
    });

    expect(ctx).not.toBeNull();
  });

  it("continues when foreign port is recoverable via installed app-data runtime", async () => {
    const refreshSetupDiagnose = vi.fn(async () =>
      makeReport({
        bundledAvailable: false,
        portStatus: "foreign",
        blockingIssue: null,
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
    const setSetupOutcome = vi.fn();

    const ctx = await runAsrOneClickPrepareDiagnose(makeDeps(), {
      refreshSetupDiagnose,
      refreshLocalRuntimeDiagnose: vi.fn(async () => null),
      pollUntilHealth: vi.fn(async () => true),
      ensureLocalRuntimeInstalled: vi.fn(async () => true),
      setSetupSteps: vi.fn((updater: unknown) =>
        typeof updater === "function" ? (updater as (steps: unknown[]) => unknown[])([]) : updater,
      ),
      setSetupMessage: vi.fn(),
      setSetupOutcome,
    });

    expect(ctx).not.toBeNull();
    expect(setSetupOutcome).not.toHaveBeenCalledWith("blocked");
  });

  it("skips manifest repair when bundled sidecar is corrupt", async () => {
    const ensureLocalRuntimeInstalled = vi.fn(async () => true);
    const refreshSetupDiagnose = vi.fn(async () =>
      makeReport({
        bundledAvailable: true,
        sidecarIntegrity: "corrupt",
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

    const ctx = await runAsrOneClickPrepareDiagnose(makeDeps(), {
      refreshSetupDiagnose,
      refreshLocalRuntimeDiagnose: vi.fn(async () => null),
      pollUntilHealth: vi.fn(async () => true),
      ensureLocalRuntimeInstalled,
      setSetupSteps: vi.fn((updater: unknown) =>
        typeof updater === "function" ? (updater as (steps: unknown[]) => unknown[])([]) : updater,
      ),
      setSetupMessage: vi.fn(),
      setSetupOutcome: vi.fn(),
    });

    expect(ctx).not.toBeNull();
    expect(ensureLocalRuntimeInstalled).not.toHaveBeenCalled();
  });

  it("blocks when port is foreign, health unreachable, and diagnose reports blockingIssue", async () => {
    const refreshSetupDiagnose = vi.fn(async () =>
      makeReport({
        bundledAvailable: false,
        portStatus: "foreign",
        blockingIssue: "8741 已被其他程序占用。",
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
    const setSetupSteps = vi.fn((updater: unknown) =>
      typeof updater === "function" ? (updater as (steps: unknown[]) => unknown[])([]) : updater,
    );
    const setSetupOutcome = vi.fn();

    const ctx = await runAsrOneClickPrepareDiagnose(makeDeps(), {
      refreshSetupDiagnose,
      refreshLocalRuntimeDiagnose: vi.fn(async () => null),
      pollUntilHealth: vi.fn(async () => true),
      ensureLocalRuntimeInstalled: vi.fn(async () => true),
      setSetupSteps,
      setSetupMessage: vi.fn(),
      setSetupOutcome,
    });

    expect(ctx).toBeNull();
    expect(setSetupOutcome).toHaveBeenCalledWith("blocked");
  });
});
