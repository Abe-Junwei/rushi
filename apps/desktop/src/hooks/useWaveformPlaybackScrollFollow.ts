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
      const tier = tierScrollRef.current;
      if (!tier) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const vw = tier.clientWidth;
      if (vw <= 0) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const t = Math.max(0, Math.min(durationSec, getPlayheadTimeSec()));
      const currentScrollLeftPx = tier.scrollLeft;
      const target = resolvePlaybackScrollFollowTargetPx({
        mode: followModeRef.current,
        timeSec: t,
        timelineWidthPx,
        durationSec,
        viewportWidthPx: vw,
        currentScrollLeftPx,
      });
      if (Math.abs(target - currentScrollLeftPx) > WAVEFORM_SCROLL_SYNC_EPSILON_PX) {
        setTierScrollPx(target, { deferLayoutCommit: true, immediate: true });
      }

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
