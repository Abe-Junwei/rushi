import { memo, useLayoutEffect, useRef, type RefObject } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { drawWaveformSegmentBands } from "../services/waveform/drawWaveformSegmentBands";
import { useTierViewportMetricsFrame } from "../hooks/useTierViewportMetricsFrame";
import {
  resolveTierViewportMetrics,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";

export type WaveformSegmentBandCanvasProps = {
  segments: SegmentDto[];
  durationSec: number;
  timelineWidthPx: number;
  layoutHeightPx: number;
  selectedIdx: number;
  dominantSpanIndices?: readonly number[];
  draftIdx: number | null;
  tierScrollRef: RefObject<HTMLElement | null>;
  tierScrollLive: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
};

export const WaveformSegmentBandCanvas = memo(function WaveformSegmentBandCanvas({
  segments,
  durationSec,
  timelineWidthPx,
  layoutHeightPx,
  selectedIdx,
  dominantSpanIndices,
  draftIdx,
  tierScrollRef,
  tierScrollLive,
  tierScrollLayout,
}: WaveformSegmentBandCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef({
    segments,
    durationSec,
    timelineWidthPx,
    layoutHeightPx,
    selectedIdx,
    dominantSpanIndices,
    draftIdx,
  });
  inputRef.current = {
    segments,
    durationSec,
    timelineWidthPx,
    layoutHeightPx,
    selectedIdx,
    dominantSpanIndices,
    draftIdx,
  };

  const tierMetricsRef = useRef({ tierScrollRef, tierScrollLive, tierScrollLayout });
  tierMetricsRef.current = { tierScrollRef, tierScrollLive, tierScrollLayout };

  const schedulePaintRef = useRef<(() => void) | null>(null);

  // Keep overlay consumers aligned; band paint always reads live tier DOM (see paint()).
  useTierViewportMetricsFrame({
    tierScrollRef,
    tierScrollLive,
    tierScrollLayout,
  });

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let paintRafId = 0;
    const paint = () => {
      paintRafId = 0;
      const input = inputRef.current;
      const tierMetrics = tierMetricsRef.current;
      const { scrollLeftPx, viewportWidthPx } = resolveTierViewportMetrics({
        tierScrollEl: tierMetrics.tierScrollRef.current,
        tierScrollLive: tierMetrics.tierScrollLive,
        tierScrollLayout: tierMetrics.tierScrollLayout,
      });
      const widthPx = Math.max(1, Math.floor(viewportWidthPx));
      const heightPx = Math.max(1, Math.floor(input.layoutHeightPx));
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(widthPx * dpr));
      canvas.height = Math.max(1, Math.floor(heightPx * dpr));
      canvas.style.width = `${widthPx}px`;
      canvas.style.height = `${heightPx}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const skipIndices: number[] = [];
      if (input.draftIdx != null && input.draftIdx >= 0) skipIndices.push(input.draftIdx);
      if (input.selectedIdx >= 0) skipIndices.push(input.selectedIdx);

      drawWaveformSegmentBands({
        ctx,
        segments: input.segments,
        dominantSpanIndices: input.dominantSpanIndices,
        scrollLeftPx,
        viewportWidthPx: widthPx,
        timelineWidthPx: input.timelineWidthPx,
        durationSec: input.durationSec,
        layoutHeightPx: heightPx,
        selectedIdx: input.selectedIdx,
        skipIndices,
      });
    };

    const schedulePaint = () => {
      if (paintRafId) return;
      paintRafId = requestAnimationFrame(paint);
    };
    schedulePaintRef.current = schedulePaint;

    schedulePaint();
    const tier = tierScrollRef.current;
    tier?.addEventListener("scroll", schedulePaint, { passive: true });
    tier?.addEventListener("wheel", schedulePaint, { passive: true });
    window.addEventListener("resize", schedulePaint);
    return () => {
      schedulePaintRef.current = null;
      tier?.removeEventListener("scroll", schedulePaint);
      tier?.removeEventListener("wheel", schedulePaint);
      window.removeEventListener("resize", schedulePaint);
      if (paintRafId) cancelAnimationFrame(paintRafId);
    };
  }, [
    layoutHeightPx,
    segments,
    durationSec,
    timelineWidthPx,
    selectedIdx,
    dominantSpanIndices,
    draftIdx,
    tierScrollRef,
  ]);

  // Wheel-forward / programmatic scroll often skips `scroll` events — layout commits via onTierScroll.
  useLayoutEffect(() => {
    schedulePaintRef.current?.();
  }, [tierScrollLayout.scrollLeftPx, tierScrollLayout.clientWidthPx]);

  return (
    <canvas
      ref={canvasRef}
      className="waveform-segment-band-canvas pointer-events-none absolute inset-0 z-[2]"
      aria-hidden
    />
  );
});
