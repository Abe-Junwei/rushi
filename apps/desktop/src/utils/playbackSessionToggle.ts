/**
 * Pure decisions for Space sticky session vs toolbar global exit hatch.
 * Spec: docs/execution/specs/global-segment-playback-cross-switch-research.md §4
 */
import type { PlaybackSession } from "./playbackSession";
import { isGlobalPlaybackSession, isSegmentPlaybackSession } from "./playbackSession";

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
   * Segment containing the playhead (structure-edit remap / Space follows playhead).
   * When valid, wins over sticky session idx and list selection.
   */
  playheadContainingIdx?: number;
  /**
   * When idle with no sticky session, Space starts scoped play on this selected
   * transcript primary if valid (≥0). Sticky global session resumes global instead.
   */
  selectedSegmentIdx?: number;
  /**
   * Blank waveform seek armed a sticky global Space intent. Keep chrome selection,
   * but do not jump back into the previously selected segment on Space.
   */
  preferGlobalSpace?: boolean;
}): SessionTogglePlayDecision {
  if (args.isPlaying) return { action: "pauseKeepingSession" };
  const atPlayhead =
    args.playheadContainingIdx != null && args.playheadContainingIdx >= 0
      ? args.playheadContainingIdx
      : undefined;
  const selected = args.selectedSegmentIdx;
  if (isSegmentPlaybackSession(args.session)) {
    if (args.segmentStillExists === false) {
      // Fall through: may still segment-play the current selection / playhead.
    } else if (
      atPlayhead != null &&
      (selected == null || selected < 0 || selected === atPlayhead)
    ) {
      // Structure remap / playhead-aligned selection: Space follows playhead segment.
      return { action: "resumeSegment", idx: atPlayhead };
    } else if (selected != null && selected >= 0 && selected !== args.session.idx) {
      // User explicitly selected/listen-jumped to a different segment while idle:
      // Space should honor the visible selection instead of reviving the stale session.
      return { action: "resumeSegment", idx: selected };
    } else {
      return { action: "resumeSegment", idx: args.session.idx };
    }
  }
  // Sticky global (toolbar / prior Space 通读 / blank seek) resumes from playhead.
  if (isGlobalPlaybackSession(args.session) || args.preferGlobalSpace) {
    return { action: "startGlobal" };
  }
  if (atPlayhead != null && (selected == null || selected < 0 || selected === atPlayhead)) {
    return { action: "resumeSegment", idx: atPlayhead };
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
