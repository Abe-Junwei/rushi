import { memo, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { subscribeAppAppearance } from "../services/ui/appAppearance";
import { drawWaveformSegmentBands } from "../services/waveform/drawWaveformSegmentBands";
import { resolveWaveformSelectionChromeView } from "../services/selection/resolveWaveformSelectionChromeView";
import {
  getTranscriptProjectionSnapshot,
  subscribeTranscriptSelectionProjection,
} from "./editor/core/transcriptProjection";
import { resolveWaveformSelectionRenderProjection } from "../services/waveform/waveformSelectionRenderProjection";
import {
  resolveTierViewportMetricsDuringScrollFrame,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";
import {
  readPlaybackTimeDuringViewportFrame,
  requestWaveformSegmentBandPaint,
  scheduleTierScrollFrame,
  subscribeTierScrollFrame,
} from "../utils/tierScrollFrameCoordinator";
import { setDirectLayoutStyle } from "../utils/cspElementLayout";
import { wfProfileIsActive, wfProfileTime } from "../services/waveform/waveformZoomProfile";
import {
  isWaveformScrollProfileEnabled,
  waveformScrollProfileBandRepaint,
  waveformScrollProfileBandSkipped,
} from "../services/waveform/waveformScrollProfile";
import { waveformFrameTimingBandPaint } from "../services/waveform/waveformFrameTimingProfile";
import {
  selectionProfileAdd,
  selectionProfileIsActive,
} from "../services/ui/selectionLatencyProfile";
import {
  computeSegmentBandCanvasWindow,
  cspLayoutLeftPxIfChanged,
  segmentBandCanvasNeedsRepaint,
} from "../utils/waveformSegmentBandCanvasScroll";
import {
  invalidateWaveformSegmentBandPaletteCache,
  readWaveformSegmentBandPalette,
} from "../utils/waveformThemeColors";
import { waveformBoundsSignature } from "../utils/boundsSignature";
import { resolveVisitedSegmentIndexAtPlayhead } from "../utils/segmentChrome";
import { registerSegmentProbeSource } from "../services/waveform/segmentProbeDevTools";

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

  const inputRef = useRef({
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
  const lastPaintedSelectionRef = useRef<{
    lo?: number;
    hi?: number;
    count?: number;
  }>({});
  const lastPaintedBoundsSignatureRef = useRef("");
  const lastPaintedVisitedFrontierRef = useRef(-2);
  const playheadSecRef = useRef<number | undefined>(undefined);
  const overlayRootRef = useRef<HTMLElement | null>(null);

  const invalidatePaintWindow = () => {
    lastPaintWindowRef.current = { leftPx: -1, widthPx: 0, heightPx: 0, bufferPx: 0 };
    lastCssLeftRef.current = null;
    lastPaintedPrimaryIdxRef.current = -2;
    lastPaintedSelectionRef.current = {};
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

    const paint = () => {
      const input = inputRef.current;
      const selectionView = resolveWaveformSelectionChromeView({
        fileId: input.fileId,
        selectedIdx: input.selectedIdx,
        selectedIndices: input.selectedIndices,
        selectionLo: input.selectionLo,
        selectionHi: input.selectionHi,
        selectionCount: input.selectionCount,
        isContiguousSelection: input.isContiguousSelection,
        segmentCount: input.segments.length,
        filterExcludesPrimary: input.filterExcludesPrimary,
      });
      const tierMetrics = tierMetricsRef.current;
      let overlayRoot = overlayRootRef.current;
      if (!overlayRoot || !overlayRoot.isConnected) {
        overlayRoot =
          tierMetrics.tierScrollRef.current?.querySelector(".waveform-segment-overlay") ?? null;
        overlayRootRef.current = overlayRoot;
      }
      const renderProjection = resolveWaveformSelectionRenderProjection({
        segmentCount: input.segments.length,
        selectedIdx: selectionView.selectedIdx,
        selectedIndices: selectionView.selectedIndices,
        selectionLo: selectionView.selectionLo,
        selectionHi: selectionView.selectionHi,
        selectionCount: selectionView.selectionCount,
        isContiguousSelection: selectionView.isContiguousSelection,
        draftIdx: input.draftIdx,
        overlayRoot,
      });
      const skipIndexSet = renderProjection.canvasSkipIndexSet;
      const { scrollLeftPx, viewportWidthPx } = resolveTierViewportMetricsDuringScrollFrame({
        tierScrollEl: tierMetrics.tierScrollRef.current,
        tierScrollLive: tierMetrics.tierScrollLive,
        tierScrollLayout: tierMetrics.tierScrollLayout,
      });
      const { leftPx, widthPx, bufferPx } = computeSegmentBandCanvasWindow({
        scrollLeftPx,
        viewportWidthPx,
        timelineWidthPx: input.timelineWidthPx,
      });
      const heightPx = Math.max(1, Math.floor(input.layoutHeightPx));
      const painted = lastPaintWindowRef.current;
      const paintedChromeVersion = lastPaintedChromeVersionRef.current;
      const proj = getTranscriptProjectionSnapshot();
      const chromeVersionNow = `p:${proj.primaryIdx}:${proj.selectionVersion}:${proj.selectedSet.size}`;
      const selectionChromeChanged = chromeVersionNow !== paintedChromeVersion;
      const selectionPrimaryChanged = selectionView.selectedIdx !== lastPaintedPrimaryIdxRef.current;
      const boundsSignatureChanged =
        input.boundsSignature !== lastPaintedBoundsSignatureRef.current;
      const playheadSec =
        playheadSecRef.current ??
        readPlaybackTimeDuringViewportFrame() ??
        getPlayheadSec?.();
      const visitedFrontier = resolveVisitedSegmentIndexAtPlayhead(
        input.segments,
        playheadSec ?? Number.NaN,
      );
      const visitedFrontierChanged = visitedFrontier !== lastPaintedVisitedFrontierRef.current;

      const windowNeedsRepaint = segmentBandCanvasNeedsRepaint({
        scrollLeftPx,
        viewportWidthPx,
        timelineWidthPx: input.timelineWidthPx,
        paintedLeftPx: painted.leftPx,
        paintedWidthPx: painted.widthPx,
        paintedHeightPx: painted.heightPx,
        layoutHeightPx: heightPx,
        bufferPx: painted.bufferPx || bufferPx,
      });
      if (
        !selectionChromeChanged &&
        !selectionPrimaryChanged &&
        !windowNeedsRepaint &&
        !boundsSignatureChanged &&
        !visitedFrontierChanged
      ) {
        waveformScrollProfileBandSkipped();
        return;
      }

      // Never use dirtyIndices here: selection-only dirty clears only current
      // segment rects, so idle pixels left in true timeline gaps (no segment)
      // survive forever and look like ghost bands that seek-but-don't-select.
      const paintStartedAt =
        isWaveformScrollProfileEnabled() || selectionProfileIsActive() ? performance.now() : 0;
      const dpr = window.devicePixelRatio || 1;
      const devW = Math.max(1, Math.floor(widthPx * dpr));
      const devH = Math.max(1, Math.floor(heightPx * dpr));
      const dims = lastCanvasDimsRef.current;
      if (dims.devW !== devW || dims.devH !== devH) {
        canvas.width = devW;
        canvas.height = devH;
        dims.devW = devW;
        dims.devH = devH;
      }
      if (dims.cssW !== widthPx || dims.cssH !== heightPx) {
        lastCssLeftRef.current = null;
        setDirectLayoutStyle(canvas, { left: leftPx, width: widthPx, height: heightPx });
        dims.cssW = widthPx;
        dims.cssH = heightPx;
        waveformScrollProfileBandRepaint(true);
      } else {
        const beforeLeft = lastCssLeftRef.current;
        cspLayoutLeftPxIfChanged(canvas, leftPx, lastCssLeftRef, setDirectLayoutStyle);
        waveformScrollProfileBandRepaint(lastCssLeftRef.current !== beforeLeft);
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const paintBands = () => {
        drawWaveformSegmentBands({
          ctx,
          segments: input.segments,
          dominantSpanSet: input.dominantSpanSet,
          scrollLeftPx: leftPx,
          viewportWidthPx: widthPx,
          timelineWidthPx: input.timelineWidthPx,
          durationSec: input.durationSec,
          layoutHeightPx: heightPx,
          selectedIdx: selectionView.selectedIdx,
          selectedIndices: selectionView.selectedIndices,
          selectionLo: selectionView.selectionLo,
          selectionHi: selectionView.selectionHi,
          selectionCount: selectionView.selectionCount,
          skipIndexSet,
          listVisibleIndexSet: input.listVisibleIndexSet,
          playheadSec,
          palette: readWaveformSegmentBandPalette(),
        });
      };
      if (wfProfileIsActive()) wfProfileTime("segmentBands", paintBands);
      else paintBands();
      if (paintStartedAt > 0) {
        const paintMs = performance.now() - paintStartedAt;
        if (isWaveformScrollProfileEnabled()) waveformFrameTimingBandPaint(paintMs);
        if (selectionProfileIsActive()) selectionProfileAdd("bandPaint", paintMs);
      }

      lastPaintWindowRef.current = { leftPx, widthPx, heightPx, bufferPx };
      lastPaintedChromeVersionRef.current = chromeVersionNow;
      lastPaintedPrimaryIdxRef.current = selectionView.selectedIdx;
      lastPaintedSelectionRef.current = {
        lo: selectionView.selectionLo,
        hi: selectionView.selectionHi,
        count: selectionView.selectionCount,
      };
      lastPaintedBoundsSignatureRef.current = input.boundsSignature;
      lastPaintedVisitedFrontierRef.current = visitedFrontier;
    };

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
