import { describe, expect, it } from "vitest";
import { reduceViewportFitPhase } from "../services/waveform/viewportFitStateMachine";

describe("viewport fit queue policy", () => {
  it("scroll-only fit finalizes without pending-peaks phase", () => {
    let phase = reduceViewportFitPhase("idle", { type: "queue", needsPeaksResample: false });
    expect(phase).toBe("pending-scroll");
    phase = reduceViewportFitPhase(phase, { type: "scrollApplied" });
    expect(phase).toBe("done");
    phase = reduceViewportFitPhase(phase, { type: "finalize" });
    expect(phase).toBe("idle");
  });

  it("resample fit waits for peaksReady before done", () => {
    let phase = reduceViewportFitPhase("idle", { type: "queue", needsPeaksResample: true });
    expect(phase).toBe("pending-peaks");
    phase = reduceViewportFitPhase(phase, { type: "peaksReady" });
    expect(phase).toBe("done");
  });
});
