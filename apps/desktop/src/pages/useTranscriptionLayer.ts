import { startTransition, useCallback, useMemo, useRef } from "react";
import { useProjectWaveform } from "../hooks/useProjectWaveform";
import type { useProjectWaveform as UseProjectWaveformHook } from "../hooks/useProjectWaveform";

type WfApi = ReturnType<typeof UseProjectWaveformHook>;
import { useSegmentKeyboard } from "../hooks/useSegmentKeyboard";
import { useTierScrollSync } from "../hooks/useTierScrollSync";
import { useWaveformDisplay } from "../hooks/useWaveformDisplay";
import { useWaveformPeaks } from "../hooks/useWaveformPeaks";
import { useWaveformZoom } from "../hooks/useWaveformZoom";
import { p1LaneBoundsSignature } from "../utils/boundsSignature";
import { computeTimelineWidthPx } from "../utils/segmentLayout";
import { assignSegmentOverlapLanes, computeSegmentLaneRowPx } from "../utils/segmentLayout";
import { useTranscriptionViewportFit } from "./useTranscriptionViewportFit";

export { TIMELINE_PX_PER_SEC, clampPxPerSec } from "../utils/pxPerSec";
export { computeSegmentLaneRowPx, assignSegmentOverlapLanes, computeTimelineWidthPx, SEGMENT_LANE_ROW_PX } from "../utils/segmentLayout";

export type TranscriptionLayerApi = ReturnType<typeof useTranscriptionLayer>;

import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

export type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

export function useTranscriptionLayer(ctx: TranscriptionLayerInput) {
  const tierScrollRef = useRef<HTMLDivElement | null>(null);
  const segmentListRef = useRef<HTMLDivElement | null>(null);
  const waveformShellRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const setSelectedIdxUi = useCallback((idx: number) => {
    startTransition(() => ctxRef.current.setSelectedIdx(idx));
  }, []);

  const display = useWaveformDisplay({ busy: ctx.busy });
  const peaks = useWaveformPeaks(ctx.projectId, ctx.mediaUrl ? ctx.fileId : null);

  const durationRef = useRef(0);
  const syncWaveformScrollRef = useRef<(scrollLeftPx: number) => void>(() => {});
  const scrollApiRef = useRef({ setTierScrollPx: (_scrollLeftPx: number) => {} });
  const wfApiRef = useRef<WfApi>(null!);
  const onWaveformScrollRef = useRef<(scrollLeftPx: number) => void>(() => {});

  const zoom = useWaveformZoom({
    getTierWidth: () => tierScrollRef.current?.clientWidth ?? 0,
    getDuration: () => durationRef.current,
    getSelectedSegment: () => ctx.segments[ctx.selectedIdx] ?? null,
  });

  const applyPendingViewportFitRef = useRef<(pxPerSec: number) => boolean>(() => false);

  const wf = useProjectWaveform({
    mediaUrl: ctx.mediaUrl,
    segments: ctx.segments,
    selectedIdx: ctx.selectedIdx,
    disabled: ctx.busy,
    minPxPerSec: zoom.pxPerSec,
    peakCache: peaks.peakCache,
    zoomDragging: zoom.zoomDragging,
    waveformHeightPx: display.waveformRenderHeightPx,
    onWaveformHeightApplied: display.markWaveformRenderHeightApplied,
    onSelectIndex: setSelectedIdxUi,
    onBoundsCommit: (idx, lo, hi) => ctx.updateSegmentBounds(idx, lo, hi, "commit"),
    onWaveformCreateRange: ctx.insertSegmentFromTimeRange,
    onWaveformScroll: (scrollLeftPx) => onWaveformScrollRef.current(scrollLeftPx),
    getViewportScrollPx: () => tierScrollRef.current?.scrollLeft ?? 0,
    onZoomApplied: (pxPerSec) => applyPendingViewportFitRef.current(pxPerSec),
  });

  durationRef.current = wf.duration || 0;
  wfApiRef.current = wf;

  const timelineWidthPx = useMemo(
    () => computeTimelineWidthPx(wf.duration || peaks.status?.durationSec || 0, zoom.pxPerSec),
    [wf.duration, peaks.status?.durationSec, zoom.pxPerSec],
  );

  const scroll = useTierScrollSync({
    tierScrollRef,
    timelineWidthPx,
    wfApiRef,
    waveformReady: wf.isReady,
    mediaUrl: ctx.mediaUrl,
  });
  syncWaveformScrollRef.current = scroll.syncWaveformScrollPx;
  scrollApiRef.current = scroll;

  const viewportFit = useTranscriptionViewportFit({
    tierScrollRef,
    durationRef,
    syncWaveformScrollRef,
    scrollApiRef,
    wfApiRef,
    zoom,
    currentPxPerSec: zoom.pxPerSec,
    renderTimelineWidthPx: timelineWidthPx,
    waveformReady: wf.isReady,
    mediaUrl: ctx.mediaUrl,
    getSelectedSegment: () => ctx.segments[ctx.selectedIdx] ?? null,
  });
  onWaveformScrollRef.current = viewportFit.onWaveformScroll;
  applyPendingViewportFitRef.current = viewportFit.applyPendingViewportFit;

  const keyboard = useSegmentKeyboard({
    ctxRef,
    wfApiRef,
    setSelectedIdxUi,
    tierScrollRef,
  });

  const segmentLaneRowPx = useMemo(() => computeSegmentLaneRowPx(display.transcriptFontPx), [display.transcriptFontPx]);

  const laneBoundsSig = p1LaneBoundsSignature(ctx.segments);
  const segmentLaneLayout = useMemo(() => {
    void laneBoundsSig;
    return assignSegmentOverlapLanes(ctxRef.current.segments);
  }, [laneBoundsSig]);

  const segmentToolbar = useMemo(
    () => ({
      splitAtSelection: ctx.splitAtSelection,
      mergeWithNext: ctx.mergeWithNext,
      mergeWithPrev: ctx.mergeWithPrev,
      splitDisabled: ctx.busy || ctx.segments.length === 0,
      mergeDisabled: ctx.busy || ctx.segments.length < 2 || ctx.selectedIdx >= ctx.segments.length - 1,
      mergePrevDisabled: ctx.busy || ctx.segments.length < 2 || ctx.selectedIdx <= 0,
    }),
    [ctx.busy, ctx.mergeWithNext, ctx.mergeWithPrev, ctx.segments.length, ctx.selectedIdx, ctx.splitAtSelection],
  );

  const selectSegmentAt = useCallback(
    (idx: number) => {
      const c = ctxRef.current;
      const w = wf;
      const s = c.segments[idx];
      if (!s) return;
      const tier = tierScrollRef.current;
      const segmentMidSec = (s.start_sec + s.end_sec) / 2;
      w.seek(s.start_sec);
      if (tier) {
        scroll.setTierScrollPxSmooth(segmentMidSec * zoom.pxPerSec - tier.clientWidth / 2);
      }
      setSelectedIdxUi(idx);
    },
    [scroll, setSelectedIdxUi, wf, zoom.pxPerSec],
  );

  const focusWaveformShell = useCallback(() => {
    waveformShellRef.current?.focus();
  }, []);

  return {
    tierScrollRef,
    segmentListRef,
    waveformShellRef,
    tierScrollLayout: scroll.tierScrollLayout,
    seekFromTierClientX: scroll.seekFromTierClientX,
    setTierScrollPx: scroll.setTierScrollPx,
    onPickAbsoluteTime: scroll.onPickAbsoluteTime,
    segmentLaneLayout,
    segmentLaneRowPx,
    waveformHeightPx: display.waveformHeightPx,
    waveformRenderHeightPx: display.waveformRenderHeightPx,
    waveformPaintedHeightPx: display.waveformPaintedHeightPx,
    waveformHeightDragging: display.waveformHeightDragging,
    transcriptFontPx: display.transcriptFontPx,
    transcriptRowHeightPx: display.transcriptRowHeightPx,
    nudgeWaveformHeight: display.nudgeWaveformHeight,
    nudgeTranscriptFontPx: display.nudgeTranscriptFontPx,
    nudgeTranscriptRowHeightPx: display.nudgeTranscriptRowHeightPx,
    beginWaveformHeightDrag: display.beginWaveformHeightDrag,
    beginTranscriptFontDrag: display.beginTranscriptFontDrag,
    beginTranscriptRowHeightDrag: display.beginTranscriptRowHeightDrag,
    onTierScroll: scroll.onTierScroll,
    timelineWidthPx,
    renderTimelineWidthPx: timelineWidthPx,
    peaksLoading: peaks.loading,
    peaksError: peaks.error,
    peakCache: peaks.peakCache,
    pxPerSec: zoom.pxPerSec,
    renderPxPerSec: zoom.renderPxPerSec,
    zoomPreviewActive: zoom.zoomPreviewActive,
    zoomDragging: zoom.zoomDragging,
    zoomIn: zoom.zoomIn,
    zoomOut: zoom.zoomOut,
    resetZoom: zoom.resetZoom,
    zoomToFitTier: viewportFit.zoomToFitTier,
    zoomToFitSelection: viewportFit.zoomToFitSelection,
    setPxPerSec: zoom.setPxPerSec,
    beginZoomInteraction: zoom.beginZoomInteraction,
    commitZoomInteraction: zoom.commitZoomInteraction,
    selectSegmentAt,
    insertSegmentAfter: ctx.insertSegmentAfter,
    deleteSegmentAt: ctx.deleteSegmentAt,
    splitAtPlayhead: ctx.splitAtPlayhead,
    segmentToolbar,
    focusWaveformShell,
    onWaveformMainKeyDown: keyboard.onWaveformMainKeyDown,
    onSegmentTextareaKeyDown: keyboard.onSegmentTextareaKeyDown,
    ...wf,
  };
}
