import type { ViewportFitPhase } from "./waveformTimelineTypes";

export type ViewportFitEvent =
  | { type: "queue"; needsPeaksResample: boolean }
  | { type: "scrollApplied" }
  | { type: "peaksReady" }
  | { type: "finalize" }
  | { type: "cancel" };

/** Viewport-fit phase transitions (kept for unit tests; runtime uses pending refs only). */
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
      if (phase === "pending-scroll") return "done";
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
