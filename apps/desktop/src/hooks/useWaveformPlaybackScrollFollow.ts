import { useEffect, useRef, type RefObject } from "react";
import { scrollPxCenterTimeInViewport } from "../utils/waveformProjection";

export type UseWaveformPlaybackScrollFollowArgs = {
  tierScrollRef: RefObject<HTMLElement | null>;
  timelineWidthPx: number;
  durationSec: number;
  isPlaying: boolean;
  isReady: boolean;
  enabled: boolean;
  getPlayheadTimeSec: () => number;
  setTierScrollPx: (scrollLeftPx: number) => void;
  /** Pause follow while user manually scrolls the tier. */
  userScrollSuppressUntilRef?: React.MutableRefObject<number>;
};

/**
 * Playback follow (ADR-0005): keep playhead in view by writing tier scroll only
 * (WaveSurfer `autoScroll` is off).
 */
export function useWaveformPlaybackScrollFollow(args: UseWaveformPlaybackScrollFollowArgs): void {
  const {
    tierScrollRef,
    timelineWidthPx,
    durationSec,
    isPlaying,
    isReady,
    enabled,
    getPlayheadTimeSec,
    setTierScrollPx,
    userScrollSuppressUntilRef,
  } = args;

  const lastWrittenRef = useRef<number | null>(null);

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
      const target = scrollPxCenterTimeInViewport({
        timeSec: t,
        timelineWidthPx,
        durationSec,
        viewportWidthPx: vw,
      });
      if (lastWrittenRef.current == null || Math.abs(lastWrittenRef.current - target) > 0.5) {
        lastWrittenRef.current = target;
        setTierScrollPx(target);
      }

      raf = requestAnimationFrame(tick);
    };

    lastWrittenRef.current = null;
    raf = requestAnimationFrame(tick);
    return () => {
      lastWrittenRef.current = null;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [
    durationSec,
    enabled,
    getPlayheadTimeSec,
    isPlaying,
    isReady,
    setTierScrollPx,
    tierScrollRef,
    timelineWidthPx,
    userScrollSuppressUntilRef,
  ]);
}
