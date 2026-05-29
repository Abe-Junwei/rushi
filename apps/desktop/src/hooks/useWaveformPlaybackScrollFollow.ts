import { useEffect, useRef, type RefObject } from "react";

export type UseWaveformPlaybackScrollFollowArgs = {
  tierScrollRef: RefObject<HTMLElement | null>;
  timelineWidthPx: number;
  durationSec: number;
  isPlaying: boolean;
  isReady: boolean;
  enabled: boolean;
  getPlayheadTimeSec: () => number;
  setTierScrollPx: (scrollLeftPx: number) => void;
};

/**
 * Peaks mode playback follow (ADR-0005 S1): keep playhead in view by writing tier
 * scroll only — replaces WaveSurfer autoScroll when canvas peaks are active.
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
  } = args;

  const lastWrittenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !isPlaying || !isReady || durationSec < 0.5 || timelineWidthPx <= 0) {
      return;
    }

    let raf = 0;

    const tick = () => {
      raf = 0;
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

      const tw = Math.max(timelineWidthPx, 1);
      const t = Math.max(0, Math.min(durationSec, getPlayheadTimeSec()));
      const playheadPx = (t / durationSec) * tw;
      const maxSl = Math.max(0, tw - vw);
      const target = Math.max(0, Math.min(maxSl, playheadPx - vw / 2));
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
  ]);
}
