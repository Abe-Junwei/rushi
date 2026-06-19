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

const SEGMENT_BAND_CANVAS_BUFFER_VIEWPORTS = 1.5;

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
  const lastCanvasDimsRef = useRef({ devW: 0, devH: 0, cssW: 0, cssH: 0 });

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
      const timelineWidth = Math.max(1, input.timelineWidthPx);
      const viewportWidth = Math.max(1, viewportWidthPx);
      const bufferPx = viewportWidth * SEGMENT_BAND_CANVAS_BUFFER_VIEWPORTS;
      const widthPx = Math.max(1, Math.floor(Math.min(timelineWidth, viewportWidth + bufferPx * 2)));
      const leftPx = Math.max(0, Math.min(Math.max(0, timelineWidth - widthPx), scrollLeftPx - bufferPx));
      const heightPx = Math.max(1, Math.floor(input.layoutHeightPx));
      const dpr = window.devicePixelRatio || 1;
      const devW = Math.max(1, Math.floor(widthPx * dpr));
      const devH = Math.max(1, Math.floor(heightPx * dpr));
      // Reassigning canvas.width/height reallocates + clears the backing store — skip it
      // when unchanged so per-frame playback paints don't thrash (drawWaveformSegmentBands
      // clears the rect itself). Only resize on an actual viewport/height change.
      const dims = lastCanvasDimsRef.current;
      if (dims.devW !== devW || dims.devH !== devH) {
        canvas.width = devW;
        canvas.height = devH;
        dims.devW = devW;
        dims.devH = devH;
      }
      if (dims.cssW !== widthPx || dims.cssH !== heightPx) {
        setCspLayoutRules(canvas, { left: leftPx, width: widthPx, height: heightPx });
        dims.cssW = widthPx;
        dims.cssH = heightPx;
      } else {
        setCspLayoutRules(canvas, { left: leftPx });
      }
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
          scrollLeftPx: leftPx,
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
      className="waveform-segment-band-canvas pointer-events-none absolute top-0 z-[2]"
      aria-hidden
    />
  );
});
