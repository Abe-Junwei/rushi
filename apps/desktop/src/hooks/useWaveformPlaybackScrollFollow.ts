import { useEffect, useRef, type RefObject } from "react";
import {
  resolvePlaybackScrollFollowTargetPx,
  type WaveformPlaybackScrollFollowMode,
} from "../utils/waveformPlaybackScrollFollow";
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
  setTierScrollPx: (
    scrollLeftPx: number,
    options?: { deferLayoutCommit?: boolean; immediate?: boolean },
  ) => void;
  /** Pause follow while user manually scrolls the tier. */
  userScrollSuppressUntilRef?: React.MutableRefObject<number>;
};

function applyPlaybackScrollFollowTarget(args: {
  tierScrollRef: RefObject<HTMLElement | null>;
  timelineWidthPx: number;
  durationSec: number;
  followMode: WaveformPlaybackScrollFollowMode;
  getPlayheadTimeSec: () => number;
  setTierScrollPx: UseWaveformPlaybackScrollFollowArgs["setTierScrollPx"];
  userScrollSuppressUntilRef?: React.MutableRefObject<number>;
}): void {
  if (args.userScrollSuppressUntilRef && performance.now() < args.userScrollSuppressUntilRef.current) {
    return;
  }
  const tier = args.tierScrollRef.current;
  if (!tier) return;
  const vw = tier.clientWidth;
  if (vw <= 0) return;

  const t = Math.max(0, Math.min(args.durationSec, args.getPlayheadTimeSec()));
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
    args.setTierScrollPx(target, { deferLayoutCommit: true, immediate: true });
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
    setTierScrollPx,
    userScrollSuppressUntilRef,
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
      getPlayheadTimeSec,
      setTierScrollPx,
      userScrollSuppressUntilRef,
    });
  }, [
    durationSec,
    enabled,
    followMode,
    getPlayheadTimeSec,
    isReady,
    setTierScrollPx,
    tierScrollRef,
    timelineWidthPx,
    userScrollSuppressUntilRef,
  ]);

  useEffect(() => {
    if (!enabled || !isPlaying || !isReady || durationSec < 0.5 || timelineWidthPx <= 0) {
      return;
    }

    let raf = 0;

    const tick = () => {
      raf = 0;
      if (userScrollSuppressUntilRef && performance.now() < userScrollSuppressUntilRef.current) {
        raf = requestAnimationFrame(tick);
        return;
      }
      applyPlaybackScrollFollowTarget({
        tierScrollRef,
        timelineWidthPx,
        durationSec,
        followMode: followModeRef.current,
        getPlayheadTimeSec,
        setTierScrollPx,
        userScrollSuppressUntilRef,
      });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    durationSec,
    enabled,
    followMode,
    getPlayheadTimeSec,
    isPlaying,
    isReady,
    setTierScrollPx,
    tierScrollRef,
    timelineWidthPx,
    userScrollSuppressUntilRef,
  ]);
}
