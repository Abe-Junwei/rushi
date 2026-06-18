import { memo, useLayoutEffect, useRef, type RefObject } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { subscribeAppAppearance } from "../services/ui/appAppearance";
import { drawWaveformSegmentBands } from "../services/waveform/drawWaveformSegmentBands";
import { selectOverlayInteractiveSegmentIndices } from "../utils/waveformSegmentOverlayVisibility";
import {
  resolveTierViewportMetrics,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";
import { scheduleTierScrollFrame, subscribeTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import { setCspLayoutRules } from "../utils/cspElementLayout";
import { wfProfileIsActive, wfProfileTime } from "../services/waveform/waveformZoomProfile";

export type WaveformSegmentBandCanvasProps = {
  segments: SegmentDto[];
  durationSec: number;
  timelineWidthPx: number;
  layoutHeightPx: number;
  selectedIdx: number;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
  isContiguousSelection?: boolean;
  selectedIndices?: ReadonlySet<number>;
  dominantSpanIndices?: readonly number[];
  draftIdx: number | null;
  getPlayheadSec?: () => number;
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
  selectionLo,
  selectionHi,
  selectionCount,
  isContiguousSelection,
  selectedIndices,
  dominantSpanIndices,
  draftIdx,
  getPlayheadSec,
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
    selectionLo,
    selectionHi,
    selectionCount,
    isContiguousSelection,
    selectedIndices,
    dominantSpanIndices,
    draftIdx,
    getPlayheadSec,
  });
  inputRef.current = {
    segments,
    durationSec,
    timelineWidthPx,
    layoutHeightPx,
    selectedIdx,
    selectionLo,
    selectionHi,
    selectionCount,
    isContiguousSelection,
    selectedIndices,
    dominantSpanIndices,
    draftIdx,
    getPlayheadSec,
  };

  const tierMetricsRef = useRef({ tierScrollRef, tierScrollLive, tierScrollLayout });
  tierMetricsRef.current = { tierScrollRef, tierScrollLive, tierScrollLayout };

  const schedulePaintRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const paint = () => {
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
      setCspLayoutRules(canvas, { width: widthPx, height: heightPx });
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const skipIndices = selectOverlayInteractiveSegmentIndices({
        segmentCount: input.segments.length,
        selectedIdx: input.selectedIdx,
        selectedIndices: input.selectedIndices,
        selectionLo: input.selectionLo,
        selectionHi: input.selectionHi,
        selectionCount: input.selectionCount,
        isContiguousSelection: input.isContiguousSelection,
        draftIdx: input.draftIdx,
      });

      const paintBands = () => {
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
          selectedIndices: input.selectedIndices,
          selectionLo: input.selectionLo,
          selectionHi: input.selectionHi,
          selectionCount: input.selectionCount,
          playheadSec: input.getPlayheadSec?.(),
          skipIndices,
        });
      };
      if (wfProfileIsActive()) wfProfileTime("segmentBands", paintBands);
      else paintBands();
    };

    const schedulePaint = () => {
      scheduleTierScrollFrame();
    };
    schedulePaintRef.current = schedulePaint;

    paint();
    const unsubFrame = subscribeTierScrollFrame(paint);
    const onResize = () => scheduleTierScrollFrame();
    window.addEventListener("resize", onResize);
    const unsubAppearance = subscribeAppAppearance(schedulePaint);
    return () => {
      unsubAppearance();
      unsubFrame();
      schedulePaintRef.current = null;
      window.removeEventListener("resize", onResize);
    };
  }, [tierScrollRef, tierScrollLayout.clientWidthPx]);

  // Segment / selection data changes repaint without re-registering scroll listeners.
  useLayoutEffect(() => {
    schedulePaintRef.current?.();
  }, [
    layoutHeightPx,
    segments,
    durationSec,
    timelineWidthPx,
    selectedIdx,
    selectionLo,
    selectionHi,
    selectionCount,
    isContiguousSelection,
    selectedIndices,
    dominantSpanIndices,
    draftIdx,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="waveform-segment-band-canvas pointer-events-none absolute inset-0 z-[2]"
      aria-hidden
    />
  );
});
