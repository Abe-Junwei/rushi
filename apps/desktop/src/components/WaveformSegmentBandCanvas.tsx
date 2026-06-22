import { memo, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { subscribeAppAppearance } from "../services/ui/appAppearance";
import { drawWaveformSegmentBands } from "../services/waveform/drawWaveformSegmentBands";
import { resolveWaveformSelectionChromeView } from "../services/selection/resolveWaveformSelectionChromeView";
import {
  getSelectionChromeSnapshot,
  subscribeSelectionChrome,
} from "../services/selection/selectionChromeStore";
import { selectOverlayInteractiveSegmentIndices } from "../utils/waveformSegmentOverlayVisibility";
import {
  resolveTierViewportMetricsDuringScrollFrame,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "../utils/waveformViewport";
import {
  requestWaveformSegmentBandPaint,
  scheduleTierScrollFrame,
  subscribeTierScrollFrame,
} from "../utils/tierScrollFrameCoordinator";
import { setCspLayoutRules } from "../utils/cspElementLayout";
import { wfProfileIsActive, wfProfileTime } from "../services/waveform/waveformZoomProfile";
import {
  waveformScrollProfileBandRepaint,
  waveformScrollProfileBandSkipped,
} from "../services/waveform/waveformScrollProfile";
import {
  computeSegmentBandCanvasWindow,
  cspLayoutLeftPxIfChanged,
  segmentBandCanvasNeedsRepaint,
} from "../utils/waveformSegmentBandCanvasScroll";

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
  getPlayheadSec,
  subscribePlayheadFrame,
  tierScrollRef,
  tierScrollLive,
  tierScrollLayout,
}: WaveformSegmentBandCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chromeVersion = useSyncExternalStore(
    subscribeSelectionChrome,
    () => getSelectionChromeSnapshot().version,
    () => 0,
  );

  const dominantSpanSet = useMemo(
    () => new Set(dominantSpanIndices ?? []),
    [dominantSpanIndices],
  );

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
    getPlayheadSec,
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
    getPlayheadSec,
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
  const lastPaintedChromeVersionRef = useRef(-1);

  const lastPaintedPlayheadSecRef = useRef(Number.NaN);

  const invalidatePaintWindow = () => {
    lastPaintWindowRef.current = { leftPx: -1, widthPx: 0, heightPx: 0, bufferPx: 0 };
    lastCssLeftRef.current = null;
  };

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
      const skipIndices = selectOverlayInteractiveSegmentIndices({
        segmentCount: input.segments.length,
        selectedIdx: selectionView.selectedIdx,
        selectedIndices: selectionView.selectedIndices,
        selectionLo: selectionView.selectionLo,
        selectionHi: selectionView.selectionHi,
        selectionCount: selectionView.selectionCount,
        isContiguousSelection: selectionView.isContiguousSelection,
        draftIdx: input.draftIdx,
      });
      const skipIndexSet = new Set(skipIndices);
      const tierMetrics = tierMetricsRef.current;
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
      const chromeVersionNow = getSelectionChromeSnapshot().version;
      const selectionChromeChanged = chromeVersionNow !== paintedChromeVersion;
      const playheadSec = input.getPlayheadSec?.() ?? Number.NaN;
      const playheadChanged =
        !Number.isFinite(lastPaintedPlayheadSecRef.current) ||
        !Number.isFinite(playheadSec) ||
        Math.abs(playheadSec - lastPaintedPlayheadSecRef.current) > 1e-4;

      if (
        !selectionChromeChanged &&
        !playheadChanged &&
        !segmentBandCanvasNeedsRepaint({
          scrollLeftPx,
          viewportWidthPx,
          paintedLeftPx: painted.leftPx,
          paintedWidthPx: painted.widthPx,
          paintedHeightPx: painted.heightPx,
          layoutHeightPx: heightPx,
          bufferPx: painted.bufferPx || bufferPx,
        })
      ) {
        waveformScrollProfileBandSkipped();
        return;
      }

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
        setCspLayoutRules(canvas, { left: leftPx, width: widthPx, height: heightPx });
        dims.cssW = widthPx;
        dims.cssH = heightPx;
        waveformScrollProfileBandRepaint(true);
      } else {
        const beforeLeft = lastCssLeftRef.current;
        cspLayoutLeftPxIfChanged(canvas, leftPx, lastCssLeftRef, setCspLayoutRules);
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
          playheadSec: input.getPlayheadSec?.(),
          skipIndexSet,
        });
      };
      if (wfProfileIsActive()) wfProfileTime("segmentBands", paintBands);
      else paintBands();

      lastPaintWindowRef.current = { leftPx, widthPx, heightPx, bufferPx };
      lastPaintedChromeVersionRef.current = chromeVersionNow;
      lastPaintedPlayheadSecRef.current = playheadSec;
    };

    const schedulePaint = () => {
      scheduleTierScrollFrame();
    };
    schedulePaintRef.current = schedulePaint;

    invalidatePaintWindow();
    paint();
    const unsubFrame = subscribeTierScrollFrame(paint);
    const onResize = () => {
      invalidatePaintWindow();
      scheduleTierScrollFrame();
    };
    window.addEventListener("resize", onResize);
    const unsubAppearance = subscribeAppAppearance(() => {
      invalidatePaintWindow();
      schedulePaint();
    });
    const unsubPlayhead = subscribePlayheadFrame?.(() => {
      scheduleTierScrollFrame();
    });
    return () => {
      unsubPlayhead?.();
      unsubAppearance();
      unsubFrame();
      schedulePaintRef.current = null;
      window.removeEventListener("resize", onResize);
    };
  }, [subscribePlayheadFrame, tierScrollRef, tierScrollLayout.clientWidthPx]);

  // Segment / selection data changes repaint without re-registering scroll listeners.
  useLayoutEffect(() => {
    invalidatePaintWindow();
    requestWaveformSegmentBandPaint({ force: true });
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
    filterExcludesPrimary,
    chromeVersion,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="waveform-segment-band-canvas pointer-events-none absolute top-0 z-[2]"
      aria-hidden
    />
  );
});
