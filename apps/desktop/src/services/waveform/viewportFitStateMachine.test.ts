import { describe, expect, it } from "vitest";
import { reduceViewportFitPhase, shouldBlockWaveformScrollSync } from "./viewportFitStateMachine";

describe("viewportFitStateMachine", () => {
  it("queues scroll then peaks when resample needed", () => {
    let phase = reduceViewportFitPhase("idle", { type: "queue", needsPeaksResample: true });
    expect(phase).toBe("pending-peaks");
    phase = reduceViewportFitPhase(phase, { type: "scrollApplied" });
    expect(phase).toBe("pending-peaks");
    phase = reduceViewportFitPhase(phase, { type: "peaksReady" });
    expect(phase).toBe("done");
    phase = reduceViewportFitPhase(phase, { type: "finalize" });
    expect(phase).toBe("idle");
  });

  it("queues scroll-only when no resample needed", () => {
    let phase = reduceViewportFitPhase("idle", { type: "queue", needsPeaksResample: false });
    expect(phase).toBe("pending-scroll");
    phase = reduceViewportFitPhase(phase, { type: "scrollApplied" });
    expect(phase).toBe("pending-peaks");
    phase = reduceViewportFitPhase(phase, { type: "peaksReady" });
    expect(phase).toBe("done");
  });

  it("blocks waveform scroll sync while pending", () => {
    expect(shouldBlockWaveformScrollSync("pending-scroll")).toBe(true);
    expect(shouldBlockWaveformScrollSync("pending-peaks")).toBe(true);
    expect(shouldBlockWaveformScrollSync("idle")).toBe(false);
    expect(shouldBlockWaveformScrollSync("done")).toBe(false);
  });

  it("cancel resets to idle from any phase", () => {
    expect(reduceViewportFitPhase("pending-scroll", { type: "cancel" })).toBe("idle");
    expect(reduceViewportFitPhase("pending-peaks", { type: "cancel" })).toBe("idle");
    expect(reduceViewportFitPhase("done", { type: "cancel" })).toBe("idle");
  });

  it("scrollApplied from idle enters pending-scroll", () => {
    const phase = reduceViewportFitPhase("idle", { type: "scrollApplied" });
    expect(phase).toBe("pending-scroll");
  });

  it("finalize resets any phase to idle", () => {
    expect(reduceViewportFitPhase("done", { type: "finalize" })).toBe("idle");
    expect(reduceViewportFitPhase("pending-scroll", { type: "finalize" })).toBe("idle");
    expect(reduceViewportFitPhase("pending-peaks", { type: "finalize" })).toBe("idle");
  });

  it("peaksReady ignored when not pending-peaks", () => {
    expect(reduceViewportFitPhase("idle", { type: "peaksReady" })).toBe("idle");
    expect(reduceViewportFitPhase("pending-scroll", { type: "peaksReady" })).toBe("pending-scroll");
    expect(reduceViewportFitPhase("done", { type: "peaksReady" })).toBe("done");
  });
});
