/**
 * Pure decisions for Space sticky session vs toolbar global exit hatch.
 * Spec: docs/execution/specs/global-segment-playback-cross-switch-research.md §4
 */
import type { PlaybackSession } from "./playbackSession";
import { isSegmentPlaybackSession } from "./playbackSession";

export type SessionTogglePlayDecision =
  | { action: "pauseKeepingSession" }
  | { action: "resumeSegment"; idx: number }
  | { action: "startGlobal" };

/** Space / sticky `togglePlay` when media is idle or playing. */
export function resolveSessionTogglePlay(args: {
  isPlaying: boolean;
  session: PlaybackSession | null;
  /** False when session.idx is deleted / OOB. */
  segmentStillExists?: boolean;
  /**
   * When idle / global session (no sticky segment session), Space starts scoped
   * play on this selected transcript primary if valid (≥0).
   */
  selectedSegmentIdx?: number;
}): SessionTogglePlayDecision {
  if (args.isPlaying) return { action: "pauseKeepingSession" };
  const selected = args.selectedSegmentIdx;
  if (isSegmentPlaybackSession(args.session)) {
    if (args.segmentStillExists === false) {
      // Fall through: may still segment-play the current selection.
    } else if (selected != null && selected >= 0 && selected !== args.session.idx) {
      // User explicitly selected/listen-jumped to a different segment while idle:
      // Space should honor the visible selection instead of reviving the stale session.
      return { action: "resumeSegment", idx: selected };
    } else {
      return { action: "resumeSegment", idx: args.session.idx };
    }
  }
  if (selected != null && selected >= 0) {
    return { action: "resumeSegment", idx: selected };
  }
  return { action: "startGlobal" };
}

export type GlobalTogglePlayDecision =
  | { action: "exitSegmentToGlobal" }
  | { action: "pauseKeepingSession" }
  | { action: "startGlobal" };

/** Toolbar「全局播放」— always global intent. */
export function resolveGlobalTogglePlay(args: {
  isPlaying: boolean;
  session: PlaybackSession | null;
}): GlobalTogglePlayDecision {
  if (args.isPlaying) {
    if (isSegmentPlaybackSession(args.session)) return { action: "exitSegmentToGlobal" };
    return { action: "pauseKeepingSession" };
  }
  return { action: "startGlobal" };
}
