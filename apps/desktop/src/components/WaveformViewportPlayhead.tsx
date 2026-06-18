import { memo, useCallback, useEffect, useRef } from "react";
import { useWaveformLiveClock } from "../hooks/useWaveformLiveClock";
import { setCspLayoutRules } from "../utils/cspElementLayout";
import { playheadViewportLeftPx } from "../utils/waveformProjection";
import {
  resolveTierViewportMetrics,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";

type WaveformViewportPlayheadProps = {
  durationSec: number;
  timelineWidthPx: number;
  tierScrollLayout: TierScrollLayoutMetrics;
  tierScrollLive?: TierScrollLiveRefs;
  tierScrollRef?: React.RefObject<HTMLElement | null>;
  isPlaying: boolean;
  isReady: boolean;
  currentTimeSec: number;
  getPlayheadTime: () => number;
  formatMediaTime: (sec: number) => string;
};

/**
 * Full-height playhead in sticky viewport coordinates (same path dev + release).
 * Ruler SVG playhead is not used for embedded overlay — Tailwind stroke opacity /58
 * modifiers are not emitted in production builds (non-scale opacities).
 */
export const WaveformViewportPlayhead = memo(function WaveformViewportPlayhead({
  durationSec,
  timelineWidthPx,
  tierScrollLayout,
  tierScrollLive,
  tierScrollRef,
  isPlaying,
  isReady,
  currentTimeSec,
  getPlayheadTime,
  formatMediaTime,
}: WaveformViewportPlayheadProps) {
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const argsRef = useRef({
    durationSec,
    timelineWidthPx,
    tierScrollLayout,
    tierScrollLive,
    tierScrollRef,
    isPlaying,
    currentTimeSec,
    getPlayheadTime,
  });
  argsRef.current = {
    durationSec,
    timelineWidthPx,
    tierScrollLayout,
    tierScrollLive,
    tierScrollRef,
    isPlaying,
    currentTimeSec,
    getPlayheadTime,
  };

  const writePosition = useCallback((timeSec: number) => {
    const el = playheadRef.current;
    const args = argsRef.current;
    if (!el || args.durationSec <= 0 || args.timelineWidthPx <= 0) return;
    const metrics = resolveTierViewportMetrics({
      tierScrollEl: args.tierScrollRef?.current ?? null,
      tierScrollLive: args.tierScrollLive,
      tierScrollLayout: args.tierScrollLayout,
    });
    const leftPx = playheadViewportLeftPx(
      timeSec,
      metrics.scrollLeftPx,
      args.timelineWidthPx,
      args.durationSec,
    );
    setCspLayoutRules(el, { transform: `translate3d(${Math.round(leftPx)}px, 0, 0)` });
  }, []);

  const onPlayheadMove = useCallback(
    (timeSec: number) => {
      writePosition(timeSec);
    },
    [writePosition],
  );

  useWaveformLiveClock({
    isPlaying,
    isReady,
    currentTimeSec,
    getPlayheadTime,
    formatMediaTime,
    durationSec,
    timelineWidthPx,
    onPlayheadMove: isPlaying ? onPlayheadMove : undefined,
  });

  useEffect(() => {
    if (isPlaying || !isReady) return;
    writePosition(currentTimeSec);
  }, [
    currentTimeSec,
    isPlaying,
    isReady,
    tierScrollLayout.scrollLeftPx,
    timelineWidthPx,
    writePosition,
  ]);

  useEffect(() => {
    const scrollEl = tierScrollRef?.current;
    if (!scrollEl) return;
    const onScroll = () => {
      const args = argsRef.current;
      const timeSec = args.isPlaying ? args.getPlayheadTime() : args.currentTimeSec;
      writePosition(timeSec);
    };
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [tierScrollRef, writePosition]);

  if (!isReady || durationSec <= 0 || timelineWidthPx <= 0) {
    return null;
  }

  return <div ref={playheadRef} className="waveform-viewport-playhead" aria-hidden />;
});
