import { describe, expect, it } from "vitest";
import {
  PREPARE_STALL_MS,
  buildPrepareJobPresentation,
  formatPrepareWaitElapsed,
  mergeArtifactBusyState,
  parseSidecarPrepareStatus,
  resolveCancelledPrepareProgress,
} from "./prepareJobPresentation";

describe("parseSidecarPrepareStatus", () => {
  it("reads sidecar prepare-status fields", () => {
    expect(
      parseSidecarPrepareStatus({
        phase: "running",
        message: "downloading_vad",
        progress_percent: 42.4,
        updated_at_ms: 1_700_000_000_000,
        stale: true,
        error_code: "x",
        job_id: "job-1",
      }),
    ).toMatchObject({
      phase: "running",
      message: "downloading_vad",
      progressPercent: 42,
      updatedAtMs: 1_700_000_000_000,
      stale: true,
      errorCode: "x",
      jobId: "job-1",
    });
  });
});

describe("buildPrepareJobPresentation", () => {
  const now = 1_700_000_120_000;

  it("maps stage titles and catalog label while running", () => {
    const presentation = buildPrepareJobPresentation({
      status: parseSidecarPrepareStatus({
        phase: "running",
        message: "downloading_punc",
        progress_percent: 55,
      }),
      localBusy: true,
      modelLabel: "Paraformer",
      waitElapsedMs: 65_000,
    });

    expect(presentation.progressLabel).toBe("下载中… 55%");
    expect(presentation.wizardDetail).toBe("正在下载模型（55%）");
    expect(presentation.stageTitle).toBe("正在下载标点模型（ct-punc）…");
    expect(presentation.installMessage).toContain("已等待 1:05");
  });

  it("does not force resume on server stale alone while progress still advances", () => {
    const presentation = buildPrepareJobPresentation({
      status: parseSidecarPrepareStatus({
        phase: "running",
        message: "downloading_recognizer",
        progress_percent: 10,
        stale: true,
      }),
      localBusy: true,
      lastLocalProgressAtMs: now - 1_000,
      nowMs: now,
    });

    expect(presentation.stalled).toBe(false);
    expect(presentation.shouldForceResume).toBe(false);
  });

  it("force resumes when progress plateaus for the stall window", () => {
    const presentation = buildPrepareJobPresentation({
      status: parseSidecarPrepareStatus({
        phase: "running",
        message: "downloading_recognizer",
        progress_percent: 10,
        stale: true,
      }),
      localBusy: true,
      lastLocalProgressAtMs: now - PREPARE_STALL_MS - 1,
      nowMs: now,
    });

    expect(presentation.stalled).toBe(true);
    expect(presentation.shouldForceResume).toBe(true);
  });

  it("uses cancelling copy for wizard and catalog", () => {
    const presentation = buildPrepareJobPresentation({
      localBusy: true,
      cancelling: true,
      progressOverride: 42,
    });

    expect(presentation.progress).toBe(42);
    expect(presentation.progressLabel).toBe("正在取消… 42%");
    expect(presentation.wizardDetail).toBe("正在取消… 42%");
    expect(presentation.shouldForceResume).toBe(false);
  });

  it("preserves cancelled progress from sidecar and local max", () => {
    expect(
      resolveCancelledPrepareProgress(
        parseSidecarPrepareStatus({ phase: "cancelled", progress_percent: 38 }),
        42,
      ),
    ).toBe(42);
    expect(
      resolveCancelledPrepareProgress(
        parseSidecarPrepareStatus({ phase: "cancelled", progress_percent: 51 }),
        42,
      ),
    ).toBe(51);
  });
});

describe("formatPrepareWaitElapsed", () => {
  it("formats mm:ss", () => {
    expect(formatPrepareWaitElapsed(65_000)).toBe("1:05");
    expect(formatPrepareWaitElapsed(9_000)).toBe("0:09");
  });
});

describe("mergeArtifactBusyState", () => {
  it("prioritizes LRC over prepare for d7Kind", () => {
    expect(
      mergeArtifactBusyState({
        runtimeInstallRunning: true,
        prepareModelBusy: true,
      }).d7Kind,
    ).toBe("lrc");
  });

  it("defers env refresh when any artifact job is active", () => {
    expect(
      mergeArtifactBusyState({
        prepareModelBusy: true,
        setupBusy: false,
      }).deferEnvRefresh,
    ).toBe(true);
    expect(
      mergeArtifactBusyState({
        transcribeBusy: true,
      }).deferEnvRefresh,
    ).toBe(true);
  });
});
