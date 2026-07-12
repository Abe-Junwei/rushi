import type { PlaybackSession } from "./playbackSession";
import { isSegmentPlaybackSession } from "./playbackSession";

export type WaveformPlayheadChromeMode = "segment" | "global";

/**
 * Viewport / minimap playhead color mode from sticky playback session.
 * Segment = accent-action playhead; global = fixed black (same stroke width).
 *
 * Idle `session.global` alone does NOT force global chrome — that would make
 * “click segment after blank/global” look like global mode while Space should
 * scoped-play the selection. Global chrome requires blank-arm or live unbounded play.
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
  if (args.preferGlobalSpace) {
    return "global";
  }
  if (args.isPlaying && !args.isSelectedSegmentPlaying) {
    return "global";
  }
  return "segment";
}
