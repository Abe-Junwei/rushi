import { memo, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { subscribeAppAppearance } from "../services/ui/appAppearance";
import {
  getTranscriptProjectionSnapshot,
  subscribeTranscriptSelectionProjection,
} from "./editor/core/transcriptProjection";
import {
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";
import {
  requestWaveformSegmentBandPaint,
  scheduleTierScrollFrame,
  subscribeTierScrollFrame,
} from "../utils/tierScrollFrameCoordinator";
import {
  invalidateWaveformSegmentBandPaletteCache,
} from "../utils/waveformThemeColors";
import { waveformBoundsSignature } from "../utils/boundsSignature";
import { resolveVisitedSegmentIndexAtPlayhead } from "../utils/segmentChrome";
import { registerSegmentProbeSource } from "../services/waveform/segmentProbeDevTools";
import {
  paintWaveformSegmentBandFrame,
  type SegmentBandCanvasPaintInput,
} from "../utils/waveformSegmentBandPaintFrame";

export type WaveformSegmentBandCanvasProps = {
  fileId: string | null;
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
  filterExcludesPrimary?: boolean;
  /** When filter active: only these indices get idle band fill; null = all. */
  listVisibleIndexSet?: ReadonlySet<number> | null;
  getPlayheadSec?: () => number;
  subscribePlayheadFrame?: (cb: (timeSec: number) => void) => () => void;
  tierScrollRef: RefObject<HTMLElement | null>;
  tierScrollLive: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
};

export const WaveformSegmentBandCanvas = memo(function WaveformSegmentBandCanvas({
  fileId,
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
  filterExcludesPrimary = false,
  listVisibleIndexSet = null,
  getPlayheadSec,
  subscribePlayheadFrame,
  tierScrollRef,
  tierScrollLive,
  tierScrollLayout,
}: WaveformSegmentBandCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chromeVersion = useSyncExternalStore(
    subscribeTranscriptSelectionProjection,
    () => {
      const proj = getTranscriptProjectionSnapshot();
      return `p:${proj.primaryIdx}:${proj.selectionVersion}:${proj.selectedSet.size}`;
    },
    () => "0",
  );

  const dominantSpanSet = useMemo(
    () => new Set(dominantSpanIndices ?? []),
    [dominantSpanIndices],
  );
  const boundsSignature = useMemo(() => waveformBoundsSignature(segments), [segments]);

  const inputRef = useRef<SegmentBandCanvasPaintInput>({
    fileId,
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
    dominantSpanSet,
    draftIdx,
    filterExcludesPrimary,
    listVisibleIndexSet,
    boundsSignature,
  });
  inputRef.current = {
    fileId,
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
    dominantSpanSet,
    draftIdx,
    filterExcludesPrimary,
    listVisibleIndexSet,
    boundsSignature,
  };

  const tierMetricsRef = useRef({ tierScrollRef, tierScrollLive, tierScrollLayout });
  tierMetricsRef.current = { tierScrollRef, tierScrollLive, tierScrollLayout };

  const schedulePaintRef = useRef<(() => void) | null>(null);
  const lastCanvasDimsRef = useRef({ devW: 0, devH: 0, cssW: 0, cssH: 0 });
  const lastPaintWindowRef = useRef({
    leftPx: -1,
    widthPx: 0,
    heightPx: 0,
    bufferPx: 0,
  });
  const lastCssLeftRef = useRef<number | null>(null);
  const lastPaintedChromeVersionRef = useRef<string | number>(-1);
  const lastPaintedPrimaryIdxRef = useRef(-2);
  const lastPaintedBoundsSignatureRef = useRef("");
  const lastPaintedVisitedFrontierRef = useRef(-2);
  const playheadSecRef = useRef<number | undefined>(undefined);
  const overlayRootRef = useRef<HTMLElement | null>(null);
  const getPlayheadSecRef = useRef(getPlayheadSec);
  getPlayheadSecRef.current = getPlayheadSec;

  const paintStateRef = useRef({
    inputRef,
    tierMetricsRef,
    lastCanvasDimsRef,
    lastPaintWindowRef,
    lastCssLeftRef,
    lastPaintedChromeVersionRef,
    lastPaintedPrimaryIdxRef,
    lastPaintedBoundsSignatureRef,
    lastPaintedVisitedFrontierRef,
    playheadSecRef,
    overlayRootRef,
    get getPlayheadSec() {
      return getPlayheadSecRef.current;
    },
  });

  const invalidatePaintWindow = () => {
    lastPaintWindowRef.current = { leftPx: -1, widthPx: 0, heightPx: 0, bufferPx: 0 };
    lastCssLeftRef.current = null;
    lastPaintedPrimaryIdxRef.current = -2;
    lastPaintedBoundsSignatureRef.current = "";
    lastPaintedVisitedFrontierRef.current = -2;
    overlayRootRef.current = null;
  };

  useLayoutEffect(() => {
    registerSegmentProbeSource(() => inputRef.current.segments);
    return () => registerSegmentProbeSource(null);
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const paint = () => paintWaveformSegmentBandFrame(canvas, paintStateRef.current);

    const schedulePaint = () => {
      scheduleTierScrollFrame();
    };
    schedulePaintRef.current = schedulePaint;

    invalidatePaintWindow();
    paint();
    const unsubFrame = subscribeTierScrollFrame(paint);
    const unsubPlayhead = subscribePlayheadFrame?.((timeSec) => {
      playheadSecRef.current = timeSec;
      const frontier = resolveVisitedSegmentIndexAtPlayhead(inputRef.current.segments, timeSec);
      if (frontier !== lastPaintedVisitedFrontierRef.current) {
        schedulePaint();
      }
    });
    const onResize = () => {
      invalidatePaintWindow();
      scheduleTierScrollFrame();
    };
    window.addEventListener("resize", onResize);
    const unsubAppearance = subscribeAppAppearance(() => {
      invalidateWaveformSegmentBandPaletteCache();
      invalidatePaintWindow();
      schedulePaint();
    });
    return () => {
      unsubAppearance();
      unsubFrame();
      unsubPlayhead?.();
      schedulePaintRef.current = null;
      window.removeEventListener("resize", onResize);
    };
  }, [getPlayheadSec, subscribePlayheadFrame, tierScrollRef, tierScrollLayout.clientWidthPx]);

  // Segment / selection data changes repaint without re-registering scroll listeners.
  useLayoutEffect(() => {
    invalidatePaintWindow();
    requestWaveformSegmentBandPaint({ force: true });
  }, [
    layoutHeightPx,
    boundsSignature,
    durationSec,
    timelineWidthPx,
    dominantSpanIndices,
    filterExcludesPrimary,
    listVisibleIndexSet,
  ]);

  useLayoutEffect(() => {
    requestWaveformSegmentBandPaint();
  }, [
    chromeVersion,
    selectedIdx,
    selectionLo,
    selectionHi,
    selectionCount,
    isContiguousSelection,
    selectedIndices,
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
