/**
 * Explicit segment playback phases driven by native transport events.
 * Spec: Native Playback Maturity Phase 5.
 */
export type SegmentPlaybackPhase =
  | "idle"
  | "seeking"
  | "playing"
  | "boundStop"
  | "loop";

export function nextSegmentPlaybackPhase(
  current: SegmentPlaybackPhase,
  event:
    | "seekStart"
    | "seekDone"
    | "play"
    | "pause"
    | "boundHit"
    | "loopRestart"
    | "reset",
): SegmentPlaybackPhase {
  switch (event) {
    case "reset":
      return "idle";
    case "seekStart":
      return "seeking";
    case "seekDone":
      return current === "seeking" ? "idle" : current;
    case "play":
      return "playing";
    case "pause":
      return current === "boundStop" || current === "loop" ? current : "idle";
    case "boundHit":
      return current === "playing" ? "boundStop" : current;
    case "loopRestart":
      return "loop";
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
