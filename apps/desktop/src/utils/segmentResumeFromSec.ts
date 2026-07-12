/**
 * Resolve play-from for sticky Space / segment replay.
 *
 * Natural segment-end auto-stop must replay from segment start (session sticky UX).
 * Mid-segment pause resumes from the freeze anchor. Explicit fromSec always wins.
 *
 * Spec: docs/execution/specs/global-segment-playback-cross-switch-research.md §4.1
 */
import { segmentPlaybackReachedEnd } from "./segmentPlaybackBound";

export function resolveSegmentResumeFromSec(args: {
  segment: { start_sec: number; end_sec: number };
  targetIdx: number;
  explicitFromSec?: number;
  autoStoppedIdx: number | null;
  pausedAnchor: { idx: number; timeSec: number } | null;
}): number | undefined {
  if (args.explicitFromSec != null && Number.isFinite(args.explicitFromSec)) {
    return args.explicitFromSec;
  }
  if (args.autoStoppedIdx === args.targetIdx) {
    return Math.min(args.segment.start_sec, args.segment.end_sec);
  }
  if (args.pausedAnchor?.idx === args.targetIdx) {
    return args.pausedAnchor.timeSec;
  }
  return undefined;
}

/**
 * Space sticky segment resume: when playhead is already at/past segment end
 * (natural stop), force replay from start even if autoStopped marker was cleared.
 */
export function resolveStickySegmentSpaceFromSec(args: {
  segment: { start_sec: number; end_sec: number };
  displaySec: number;
}): number | undefined {
  const start = Math.min(args.segment.start_sec, args.segment.end_sec);
  const end = Math.max(args.segment.start_sec, args.segment.end_sec);
  if (!Number.isFinite(args.displaySec)) return undefined;
  if (segmentPlaybackReachedEnd(args.displaySec, end)) return start;
  return undefined;
}
