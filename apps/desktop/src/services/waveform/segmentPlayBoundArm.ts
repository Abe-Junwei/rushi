import type { ActiveSegmentPlaybackBound } from "../../utils/segmentPlaybackBound";

/** After a successful segment play start: arm end-bound or mark unbounded selected play. */
export function resolveSegmentBoundArmAfterPlayStart(input: {
  startAtSec: number;
  rangeStart: number;
  rangeEnd: number;
  generation: number;
}): {
  bound: ActiveSegmentPlaybackBound | null;
  unboundedSelectedPlayGen: number | null;
} {
  const insideAtStart = input.startAtSec >= input.rangeStart && input.startAtSec < input.rangeEnd;
  if (!insideAtStart) {
    return { bound: null, unboundedSelectedPlayGen: input.generation };
  }
  // Mid-segment resume near the tail: arm immediately so a sparse first frame
  // past end still stops. Restart-from-start (natural-end replay): stay unarmed
  // until a frame is near start / inside — a stale end-time frame must not
  // immediately re-stop (display rewound, media still at end for one tick).
  const clearOfEnd = input.startAtSec < input.rangeEnd - 0.05;
  const startingNearSegmentStart = input.startAtSec <= input.rangeStart + 0.05;
  return {
    bound: {
      startSec: input.rangeStart,
      endSec: input.rangeEnd,
      generation: input.generation,
      armed: clearOfEnd && !startingNearSegmentStart,
    },
    unboundedSelectedPlayGen: null,
  };
}

/** Space while media playing: treat as "play this segment" when no scoped/unbounded stop chrome. */
export function shouldPlayThisSegmentInsteadOfPause(input: {
  segmentBoundStopInFlight: boolean;
  activeScopedBound: boolean;
  activeUnboundedSelected: boolean;
}): boolean {
  return (
    !input.segmentBoundStopInFlight &&
    !input.activeScopedBound &&
    !input.activeUnboundedSelected
  );
}

/** Loop toggle: when near/past end, restart from range start; else resume with loop. */
export function resolveLoopTogglePlayOptions(input: {
  playheadSec: number;
  rangeStart: number;
  rangeEnd: number;
}): { fromSec?: number; loop: true } {
  const fromSec =
    input.playheadSec >= input.rangeEnd - 0.05 ? input.rangeStart : undefined;
  return fromSec != null ? { fromSec, loop: true } : { loop: true };
}
