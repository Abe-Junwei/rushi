import { useEffect, useRef, type RefObject } from "react";
import {
  resolvePlaybackScrollFollowTargetPx,
  type WaveformPlaybackScrollFollowMode,
} from "../utils/waveformPlaybackScrollFollow";
import { PLAYHEAD_FRAME_PRIORITY_SCROLL } from "./useWaveformVisualPlayheadClock";
import { WAVEFORM_SCROLL_SYNC_EPSILON_PX } from "../utils/waveformScrollSync";
import {
  readPlaybackFractionalPx,
  scheduleTierScrollFrame,
  setPlaybackFractionalPx,
} from "../utils/tierScrollFrameCoordinator";
import {
  CENTER_FOLLOW_RECONCILE_PX,
  PLAYBACK_SUBPIXEL_ENABLED,
  SUBPIXEL_DEBUG_AMPLIFY,
  clearPlaybackFollowDriving,
  setCenterFollowDriving,
  setEdgeFollowDriving,
} from "../utils/waveformPlaybackSubpixel";

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

function writeFollowScroll(
  playbackFollowScroll: UseWaveformPlaybackScrollFollowArgs["playbackFollowScroll"],
  px: number,
  deferLayoutCommit?: boolean,
): void {
  if (deferLayoutCommit !== undefined) {
    playbackFollowScroll(px, { deferLayoutCommit });
  } else {
    playbackFollowScroll(px);
  }
}

/** Sink float offset into integer scrollLeft so clearing the residual does not jump. */
function sinkPlaybackOffsetIntoScroll(args: {
  tierScrollRef: RefObject<HTMLElement | null>;
  playbackFollowScroll: UseWaveformPlaybackScrollFollowArgs["playbackFollowScroll"];
  deferLayoutCommit?: boolean;
}): void {
  const tier = args.tierScrollRef.current;
  const offset = readPlaybackFractionalPx();
  if (!tier || offset === 0) {
    setPlaybackFractionalPx(0);
    return;
  }
  const sunk = Math.round(tier.scrollLeft + offset);
  writeFollowScroll(args.playbackFollowScroll, sunk, args.deferLayoutCommit);
  setPlaybackFractionalPx(0);
}

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
  /**
   * P1 path: freeze scrollLeft; broadcast float offset = T − S;
   * reconcile (write round(T)) only when |offset| ≥ CENTER_FOLLOW_RECONCILE_PX.
   * Center: always while playing. Edge: only while past the edge trigger.
   */
  subpixelFollow?: boolean;
}): void {
  if (args.userScrollSuppressUntilRef && performance.now() < args.userScrollSuppressUntilRef.current) {
    clearPlaybackFollowDriving();
    sinkPlaybackOffsetIntoScroll({
      tierScrollRef: args.tierScrollRef,
      playbackFollowScroll: args.playbackFollowScroll,
      deferLayoutCommit: args.deferLayoutCommit,
    });
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

  // Edge mid-band: target === S → not page-driving. Sink any leftover float so
  // content stays put and the needle sweeps over a stationary background.
  const edgePageDriving =
    args.followMode === "edge" &&
    Math.abs(target - currentScrollLeftPx) > WAVEFORM_SCROLL_SYNC_EPSILON_PX;

  // P1: freeze integer scroll; GPU transform carries continuous motion via offset.
  const subpixel =
    PLAYBACK_SUBPIXEL_ENABLED &&
    args.subpixelFollow === true &&
    (args.followMode === "center" || edgePageDriving);

  if (subpixel) {
    if (args.followMode === "center") {
      setCenterFollowDriving(true);
      setEdgeFollowDriving(false);
    } else {
      setCenterFollowDriving(false);
      setEdgeFollowDriving(true);
    }
    const offset = target - currentScrollLeftPx;
    // Edge page jumps are ≈0.73×vw; keep the whole jump in float so the needle
    // can hard-pin at anchor without an integer scrollLeft tear. Stay inside the
    // ≈1.5-viewport peaks window budget.
    const reconcilePx =
      args.followMode === "edge"
        ? Math.max(CENTER_FOLLOW_RECONCILE_PX, vw * 0.85)
        : CENTER_FOLLOW_RECONCILE_PX;
    if (Math.abs(offset) >= reconcilePx) {
      const rounded = Math.round(target);
      writeFollowScroll(args.playbackFollowScroll, rounded, args.deferLayoutCommit);
      setPlaybackFractionalPx((target - rounded) * SUBPIXEL_DEBUG_AMPLIFY);
    } else {
      setPlaybackFractionalPx(offset * SUBPIXEL_DEBUG_AMPLIFY);
    }
    return;
  }

  // Edge mid-band (or subpixel off): clear driving + residual, then optional integer snap.
  clearPlaybackFollowDriving();
  // Playing edge mid-band: sink leftover float from a prior page-drive, then stop.
  // Do not fall through to an integer chase (target === S by definition here).
  if (PLAYBACK_SUBPIXEL_ENABLED && args.subpixelFollow === true && args.followMode === "edge") {
    if (readPlaybackFractionalPx() !== 0) {
      sinkPlaybackOffsetIntoScroll({
        tierScrollRef: args.tierScrollRef,
        playbackFollowScroll: args.playbackFollowScroll,
        deferLayoutCommit: args.deferLayoutCommit,
      });
    } else {
      setPlaybackFractionalPx(0);
    }
    return;
  }
  setPlaybackFractionalPx(0);
  // Paused / edge snaps: center lands on integer scroll.
  const scrollTarget =
    PLAYBACK_SUBPIXEL_ENABLED && args.followMode === "center" ? Math.round(target) : target;
  const minDeltaPx =
    args.followMode === "center" ? 0 : WAVEFORM_SCROLL_SYNC_EPSILON_PX;
  if (Math.abs(scrollTarget - currentScrollLeftPx) <= minDeltaPx) {
    return;
  }
  writeFollowScroll(args.playbackFollowScroll, scrollTarget, args.deferLayoutCommit);
}

/**
 * Playback follow (ADR-0005): keep playhead in view by writing tier scroll only
 * (WaveSurfer `autoScroll` is off).
 *
 * - center: stationary playhead (Logic scroll-in-play / Audition Centered)
 *   P1: freeze scrollLeft; float offset on content; reconcile past threshold
 * - edge: follow when playhead nears viewport edges (Audacity Follow Playhead)
 *   P1 only while past trigger (page-drive); mid-band clears offset
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
    // Paused / mode-change snaps only. While playing, the playback-tick P1 path owns
    // scroll + float offset — running the integer snap here would write float targets
    // into scrollLeft and erase the freeze/reconcile contract.
    if (!enabled || !isReady || isPlaying || durationSec < 0.5 || timelineWidthPx <= 0) {
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
      deferLayoutCommit: false,
    });
  }, [
    durationSec,
    enabled,
    followMode,
    getPlayheadTimeSec,
    isPlaying,
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
    const unsubscribe = subscribePlayheadFrame((timeSec) => {
      applyPlaybackScrollFollowTarget({
        tierScrollRef,
        timelineWidthPx,
        durationSec,
        followMode: followModeRef.current,
        playheadTimeSec: timeSec,
        playbackFollowScroll,
        userScrollSuppressUntilRef,
        subpixelFollow: true,
      });
    }, PLAYHEAD_FRAME_PRIORITY_SCROLL);
    return () => {
      unsubscribe();
      clearPlaybackFollowDriving();
      // Stop playing → sink residual into scrollLeft so content does not jump, then
      // clear offset and repaint.
      sinkPlaybackOffsetIntoScroll({
        tierScrollRef,
        playbackFollowScroll,
        deferLayoutCommit: false,
      });
      scheduleTierScrollFrame();
    };
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
