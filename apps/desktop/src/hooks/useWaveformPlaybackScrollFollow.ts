import { useEffect, useRef, type RefObject } from "react";
import {
  resolvePlaybackScrollFollowTargetPx,
  type WaveformPlaybackScrollFollowMode,
} from "../utils/waveformPlaybackScrollFollow";
import { PLAYHEAD_FRAME_PRIORITY_SCROLL } from "./useWaveformVisualPlayheadClock";
import { WAVEFORM_SCROLL_SYNC_EPSILON_PX } from "../utils/waveformScrollSync";

export type UseWaveformPlaybackScrollFollowArgs = {
  tierScrollRef: RefObject<HTMLElement | null>;
  timelineWidthPx: number;
  durationSec: number;
  isPlaying: boolean;
  isReady: boolean;
  enabled: boolean;
  followMode: WaveformPlaybackScrollFollowMode;
  getPlayheadTimeSec: () => number;
  playbackFollowScroll: (
    scrollLeftPx: number,
    options?: { deferLayoutCommit?: boolean },
  ) => void;
  /** Pause follow while user manually scrolls the tier. */
  userScrollSuppressUntilRef?: React.MutableRefObject<number>;
  /** Single playback tick bus; follow runs here (priority 0) instead of its own rAF. */
  subscribePlayheadFrame: (
    cb: (timeSec: number) => void,
    priority?: number,
  ) => () => void;
};

function applyPlaybackScrollFollowTarget(args: {
  tierScrollRef: RefObject<HTMLElement | null>;
  timelineWidthPx: number;
  durationSec: number;
  followMode: WaveformPlaybackScrollFollowMode;
  playheadTimeSec: number;
  playbackFollowScroll: UseWaveformPlaybackScrollFollowArgs["playbackFollowScroll"];
  userScrollSuppressUntilRef?: React.MutableRefObject<number>;
  /** Playing frames defer React layout; paused snaps commit immediately. */
  deferLayoutCommit?: boolean;
}): void {
  if (args.userScrollSuppressUntilRef && performance.now() < args.userScrollSuppressUntilRef.current) {
    return;
  }
  const tier = args.tierScrollRef.current;
  if (!tier) return;
  const vw = tier.clientWidth;
  if (vw <= 0) return;

  const t = Math.max(0, Math.min(args.durationSec, args.playheadTimeSec));
  const currentScrollLeftPx = tier.scrollLeft;
  const target = resolvePlaybackScrollFollowTargetPx({
    mode: args.followMode,
    timeSec: t,
    timelineWidthPx: args.timelineWidthPx,
    durationSec: args.durationSec,
    viewportWidthPx: vw,
    currentScrollLeftPx,
  });
  if (Math.abs(target - currentScrollLeftPx) > WAVEFORM_SCROLL_SYNC_EPSILON_PX) {
    if (args.deferLayoutCommit !== undefined) {
      args.playbackFollowScroll(target, { deferLayoutCommit: args.deferLayoutCommit });
    } else {
      args.playbackFollowScroll(target);
    }
  }
}

/**
 * Playback follow (ADR-0005): keep playhead in view by writing tier scroll only
 * (WaveSurfer `autoScroll` is off).
 *
 * - center: stationary playhead (Logic scroll-in-play / Audition Centered)
 * - edge: follow when playhead nears viewport edges (Audacity Follow Playhead)
 */
export function useWaveformPlaybackScrollFollow(args: UseWaveformPlaybackScrollFollowArgs): void {
  const {
    tierScrollRef,
    timelineWidthPx,
    durationSec,
    isPlaying,
    isReady,
    enabled,
    followMode,
    getPlayheadTimeSec,
    playbackFollowScroll,
    userScrollSuppressUntilRef,
    subscribePlayheadFrame,
  } = args;

  const followModeRef = useRef(followMode);
  followModeRef.current = followMode;

  useEffect(() => {
    if (!enabled || !isReady || durationSec < 0.5 || timelineWidthPx <= 0) {
      return;
    }
    applyPlaybackScrollFollowTarget({
      tierScrollRef,
      timelineWidthPx,
      durationSec,
      followMode,
      playheadTimeSec: getPlayheadTimeSec(),
      playbackFollowScroll,
      userScrollSuppressUntilRef,
      // Paused / mode-change snaps must commit React layout immediately.
      deferLayoutCommit: false,
    });
  }, [
    durationSec,
    enabled,
    followMode,
    getPlayheadTimeSec,
    isReady,
    playbackFollowScroll,
    tierScrollRef,
    timelineWidthPx,
    userScrollSuppressUntilRef,
  ]);

  useEffect(() => {
    if (!enabled || !isPlaying || !isReady || durationSec < 0.5 || timelineWidthPx <= 0) {
      return;
    }
    // Runs inside the single playback tick (before the playhead transform) so scroll
    // and playhead share the same frame's time — no separate follow rAF.
    return subscribePlayheadFrame((timeSec) => {
      applyPlaybackScrollFollowTarget({
        tierScrollRef,
        timelineWidthPx,
        durationSec,
        followMode: followModeRef.current,
        playheadTimeSec: timeSec,
        playbackFollowScroll,
        userScrollSuppressUntilRef,
        // Prefer prefs default (defer while playing) — omit so flag controls rollback.
      });
    }, PLAYHEAD_FRAME_PRIORITY_SCROLL);
  }, [
    durationSec,
    enabled,
    followMode,
    getPlayheadTimeSec,
    isPlaying,
    isReady,
    playbackFollowScroll,
    subscribePlayheadFrame,
    tierScrollRef,
    timelineWidthPx,
    userScrollSuppressUntilRef,
  ]);
}
