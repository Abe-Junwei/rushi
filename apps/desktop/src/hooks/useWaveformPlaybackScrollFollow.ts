import { useEffect, useRef, type RefObject } from "react";
import type { WaveformPlaybackScrollFollowMode } from "../utils/waveformPlaybackScrollFollow";
import { PLAYHEAD_FRAME_PRIORITY_SCROLL } from "./useWaveformVisualPlayheadClock";
import {
  readPlaybackFractionalPx,
  scheduleTierScrollFrame,
  setPlaybackFractionalPx,
} from "../utils/tierScrollFrameCoordinator";
import {
  clearPlaybackFollowDriving,
} from "../utils/waveformPlaybackSubpixel";
import {
  calculatePlaybackFollowGeometry,
  commitPlaybackFollowGeometry,
} from "../utils/waveformPlaybackRenderSnapshot";

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
  deferLayoutCommit?: boolean;
  subpixelFollow?: boolean;
}): void {
  if (args.userScrollSuppressUntilRef && performance.now() < args.userScrollSuppressUntilRef.current) {
    return;
  }
  const tier = args.tierScrollRef.current;
  if (!tier) return;
  const vw = tier.clientWidth;
  if (vw <= 0) return;

  const geometry = calculatePlaybackFollowGeometry({
    followMode: args.followMode,
    timeSec: args.playheadTimeSec,
    timelineWidthPx: args.timelineWidthPx,
    durationSec: args.durationSec,
    viewportWidthPx: vw,
    currentScrollLeftPx: tier.scrollLeft,
    currentFractionalPx: readPlaybackFractionalPx(),
    subpixelFollow: Boolean(args.subpixelFollow),
  });

  commitPlaybackFollowGeometry({
    geometry,
    playbackFollowScroll: args.playbackFollowScroll,
    deferLayoutCommit: args.deferLayoutCommit,
    writeSnapshot: Boolean(args.subpixelFollow),
  });
}

/** Sink float offset into integer scrollLeft (stop / cleanup path). */
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
  if (args.deferLayoutCommit !== undefined) {
    args.playbackFollowScroll(sunk, { deferLayoutCommit: args.deferLayoutCommit });
  } else {
    args.playbackFollowScroll(sunk);
  }
  setPlaybackFractionalPx(0);
}

/**
 * Playback follow (ADR-0005): keep playhead in view by writing tier scroll only
 * (WaveSurfer `autoScroll` is off).
 *
 * P1: calculate → commit via {@link calculatePlaybackFollowGeometry} — no mid-frame
 * feedback writes. Edge large jumps hard-clear fractional continuity.
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
