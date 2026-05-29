import type { ViewportFitPhase } from "./waveformTimelineTypes";

export type ViewportFitEvent =
  | { type: "queue"; needsPeaksResample: boolean }
  | { type: "scrollApplied" }
  | { type: "peaksReady" }
  | { type: "finalize" }
  | { type: "cancel" };

/** Minimal viewport-fit phase transitions (ADR-0005 S4). */
export function reduceViewportFitPhase(
  phase: ViewportFitPhase,
  event: ViewportFitEvent,
): ViewportFitPhase {
  switch (event.type) {
    case "cancel":
      return "idle";
    case "queue":
      return event.needsPeaksResample ? "pending-peaks" : "pending-scroll";
    case "scrollApplied":
      if (phase === "pending-scroll") return "pending-peaks";
      if (phase === "pending-peaks") return phase;
      return phase === "idle" ? "pending-scroll" : phase;
    case "peaksReady":
      if (phase === "pending-peaks") return "done";
      return phase;
    case "finalize":
      return "idle";
    default:
      return phase;
  }
}

export function shouldBlockWaveformScrollSync(phase: ViewportFitPhase): boolean {
  return phase === "pending-scroll" || phase === "pending-peaks";
}
