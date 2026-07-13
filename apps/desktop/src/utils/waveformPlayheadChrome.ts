import type { PlaybackSession } from "./playbackSession";
import { isGlobalPlaybackSession, isSegmentPlaybackSession } from "./playbackSession";

export type WaveformPlayheadChromeMode = "segment" | "global";

/**
 * Viewport / minimap playhead color mode from sticky playback session.
 * Segment = accent-action playhead; global = fixed black (same stroke width).
 *
 * Sticky `session.global` (incl. paused 通读) keeps global chrome so Space resume
 * matches visuals. Blank-arm also forces global. Default idle (null session) is segment.
 */
export function resolveWaveformPlayheadChromeMode(args: {
  session: PlaybackSession | null;
  isPlaying: boolean;
  isSelectedSegmentPlaying: boolean;
  preferGlobalSpace?: boolean;
}): WaveformPlayheadChromeMode {
  if (isSegmentPlaybackSession(args.session) || args.isSelectedSegmentPlaying) {
    return "segment";
  }
  if (args.preferGlobalSpace || isGlobalPlaybackSession(args.session)) {
    return "global";
  }
  if (args.isPlaying && !args.isSelectedSegmentPlaying) {
    return "global";
  }
  return "segment";
}
