import type { SegmentDto } from "../tauri/projectApi";
import { drawWaveformSegmentBands } from "../services/waveform/drawWaveformSegmentBands";
import { resolveWaveformSelectionChromeView } from "../services/selection/resolveWaveformSelectionChromeView";
import { getTranscriptProjectionSnapshot } from "../components/editor/core/transcriptProjection";
import { resolveWaveformSelectionRenderProjection } from "../services/waveform/waveformSelectionRenderProjection";
import {
  resolveTierViewportMetricsDuringScrollFrame,
  type TierScrollLayoutMetrics,
  type TierScrollLiveRefs,
} from "./waveformViewport";
import { readPlaybackTimeDuringViewportFrame } from "./tierScrollFrameCoordinator";
import { setDirectLayoutStyle } from "./cspElementLayout";
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
} from "./waveformSegmentBandCanvasScroll";
import { readWaveformSegmentBandPalette } from "./waveformThemeColors";
import { resolveVisitedSegmentIndexAtPlayhead } from "./segmentChrome";
import type { RefObject } from "react";

export type SegmentBandCanvasPaintInput = {
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
  dominantSpanSet: Set<number>;
  draftIdx: number | null;
  filterExcludesPrimary: boolean;
  listVisibleIndexSet: ReadonlySet<number> | null;
  boundsSignature: string;
};

export type SegmentBandCanvasPaintState = {
  inputRef: { current: SegmentBandCanvasPaintInput };
  tierMetricsRef: {
    current: {
      tierScrollRef: RefObject<HTMLElement | null>;
      tierScrollLive: TierScrollLiveRefs;
      tierScrollLayout: TierScrollLayoutMetrics;
    };
  };
  lastCanvasDimsRef: { current: { devW: number; devH: number; cssW: number; cssH: number } };
  lastPaintWindowRef: {
    current: { leftPx: number; widthPx: number; heightPx: number; bufferPx: number };
  };
  lastCssLeftRef: { current: number | null };
  lastPaintedChromeVersionRef: { current: string | number };
  lastPaintedPrimaryIdxRef: { current: number };
  lastPaintedBoundsSignatureRef: { current: string };
  lastPaintedVisitedFrontierRef: { current: number };
  playheadSecRef: { current: number | undefined };
  overlayRootRef: { current: HTMLElement | null };
  getPlayheadSec?: () => number;
};

/** One band-canvas paint frame (scroll / selection / visited frontier). */
export function paintWaveformSegmentBandFrame(
  canvas: HTMLCanvasElement,
  state: SegmentBandCanvasPaintState,
): void {
  const input = state.inputRef.current;
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
  const tierMetrics = state.tierMetricsRef.current;
  let overlayRoot = state.overlayRootRef.current;
  if (!overlayRoot || !overlayRoot.isConnected) {
    overlayRoot =
      tierMetrics.tierScrollRef.current?.querySelector(".waveform-segment-overlay") ?? null;
    state.overlayRootRef.current = overlayRoot;
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
  const painted = state.lastPaintWindowRef.current;
  const paintedChromeVersion = state.lastPaintedChromeVersionRef.current;
  const proj = getTranscriptProjectionSnapshot();
  const chromeVersionNow = `p:${proj.primaryIdx}:${proj.selectionVersion}:${proj.selectedSet.size}`;
  const selectionChromeChanged = chromeVersionNow !== paintedChromeVersion;
  const selectionPrimaryChanged = selectionView.selectedIdx !== state.lastPaintedPrimaryIdxRef.current;
  const boundsSignatureChanged =
    input.boundsSignature !== state.lastPaintedBoundsSignatureRef.current;
  const playheadSec =
    state.playheadSecRef.current ??
    readPlaybackTimeDuringViewportFrame() ??
    state.getPlayheadSec?.();
  const visitedFrontier = resolveVisitedSegmentIndexAtPlayhead(
    input.segments,
    playheadSec ?? Number.NaN,
  );
  const visitedFrontierChanged = visitedFrontier !== state.lastPaintedVisitedFrontierRef.current;

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
  const dims = state.lastCanvasDimsRef.current;
  if (dims.devW !== devW || dims.devH !== devH) {
    canvas.width = devW;
    canvas.height = devH;
    dims.devW = devW;
    dims.devH = devH;
  }
  if (dims.cssW !== widthPx || dims.cssH !== heightPx) {
    state.lastCssLeftRef.current = null;
    setDirectLayoutStyle(canvas, { left: leftPx, width: widthPx, height: heightPx });
    dims.cssW = widthPx;
    dims.cssH = heightPx;
    waveformScrollProfileBandRepaint(true);
  } else {
    const beforeLeft = state.lastCssLeftRef.current;
    cspLayoutLeftPxIfChanged(canvas, leftPx, state.lastCssLeftRef, setDirectLayoutStyle);
    waveformScrollProfileBandRepaint(state.lastCssLeftRef.current !== beforeLeft);
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

  state.lastPaintWindowRef.current = { leftPx, widthPx, heightPx, bufferPx };
  state.lastPaintedChromeVersionRef.current = chromeVersionNow;
  state.lastPaintedPrimaryIdxRef.current = selectionView.selectedIdx;
  state.lastPaintedBoundsSignatureRef.current = input.boundsSignature;
  state.lastPaintedVisitedFrontierRef.current = visitedFrontier;
}
