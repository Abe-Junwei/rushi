import { startTransition, useCallback, useEffect, useMemo, useRef } from "react";
import { useProjectWaveform } from "../hooks/useProjectWaveform";
import { useSegmentKeyboard } from "../hooks/useSegmentKeyboard";
import { useTierScrollSync } from "../hooks/useTierScrollSync";
import { useWaveformDisplay } from "../hooks/useWaveformDisplay";
import { useWaveformZoom } from "../hooks/useWaveformZoom";
import { p1LaneBoundsSignature } from "../utils/boundsSignature";
import { computeTimelineWidthPx } from "../utils/segmentLayout";
import { assignSegmentOverlapLanes, computeSegmentLaneRowPx } from "../utils/segmentLayout";
import type { SegmentDto } from "../tauri/projectApi";

export { TIMELINE_PX_PER_SEC, clampPxPerSec } from "../utils/pxPerSec";
export { computeSegmentLaneRowPx, assignSegmentOverlapLanes, computeTimelineWidthPx, SEGMENT_LANE_ROW_PX } from "../utils/segmentLayout";

export type TranscriptionLayerApi = ReturnType<typeof useTranscriptionLayer>;

export type TranscriptionLayerInput = {
  mediaUrl: string | null;
  segments: SegmentDto[];
  selectedIdx: number;
  setSelectedIdx: (idx: number) => void;
  busy: boolean;
  undo: () => void;
  redo: () => void;
  updateSegmentBounds: (idx: number, startSec: number, endSec: number, phase?: "live" | "commit") => void;
  insertSegmentFromTimeRange: (startSec: number, endSec: number) => void;
  splitAtSelection: () => void;
  splitAtPlayhead: (timeSec: number) => void;
  mergeWithNext: () => void;
  mergeWithPrev: () => void;
  insertSegmentAfter: (idx: number) => void;
  deleteSegmentAt: (idx: number) => void;
};

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

  const durationRef = useRef(0);
  const syncWaveformScrollRef = useRef<(scrollLeftPx: number) => void>(() => {});

  const zoom = useWaveformZoom({
    getTierWidth: () => tierScrollRef.current?.clientWidth ?? 0,
    getDuration: () => durationRef.current,
    getSelectedSegment: () => ctx.segments[ctx.selectedIdx] ?? null,
  });

  const wf = useProjectWaveform({
    mediaUrl: ctx.mediaUrl,
    segments: ctx.segments,
    selectedIdx: ctx.selectedIdx,
    disabled: ctx.busy,
    minPxPerSec: zoom.renderPxPerSec,
    waveformHeightPx: display.waveformRenderHeightPx,
    onWaveformHeightApplied: display.markWaveformRenderHeightApplied,
    onSelectIndex: setSelectedIdxUi,
    onBoundsCommit: (idx, lo, hi) => ctx.updateSegmentBounds(idx, lo, hi, "commit"),
    onWaveformCreateRange: ctx.insertSegmentFromTimeRange,
    onWaveformScroll: (sl) => syncWaveformScrollRef.current(sl),
    getViewportScrollPx: () => tierScrollRef.current?.scrollLeft ?? 0,
  });

  durationRef.current = wf.duration || 0;

  const wfApiRef = useRef(wf);
  wfApiRef.current = wf;

  const timelineWidthPx = useMemo(
    () => computeTimelineWidthPx(wf.duration || 0, zoom.pxPerSec),
    [wf.duration, zoom.pxPerSec],
  );
  const renderTimelineWidthPx = useMemo(
    () => computeTimelineWidthPx(wf.duration || 0, zoom.renderPxPerSec),
    [wf.duration, zoom.renderPxPerSec],
  );

  const scroll = useTierScrollSync({
    tierScrollRef,
    timelineWidthPx,
    wfApiRef,
    waveformReady: wf.isReady,
    mediaUrl: ctx.mediaUrl,
  });
  syncWaveformScrollRef.current = scroll.syncWaveformScrollPx;

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
      const w = wfApiRef.current;
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
    [scroll, setSelectedIdxUi, zoom.pxPerSec],
  );

  const focusWaveformShell = useCallback(() => {
    waveformShellRef.current?.focus();
  }, []);

  // 真实 WaveSurfer zoom 完成后：将 tier 与 WS 的 scrollLeft 钳到同一值，避免语段卡与 region 错位。
  useEffect(() => {
    const tier = tierScrollRef.current;
    if (!tier || !wf.isReady || renderTimelineWidthPx <= 0) return;
    const maxSl = Math.max(0, renderTimelineWidthPx - tier.clientWidth);
    const wsSl = wf.getScrollLeft();
    const sl = Math.min(maxSl, Math.max(0, wsSl));
    scroll.setTierScrollPx(sl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom.renderPxPerSec, renderTimelineWidthPx, wf.isReady, wf.getScrollLeft, scroll.setTierScrollPx]);

  useEffect(() => {
    if (!ctx.mediaUrl || !wf.isReady) return;
    scroll.setTierScrollPx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.mediaUrl, wf.isReady, scroll.setTierScrollPx]);

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
    renderTimelineWidthPx,
    pxPerSec: zoom.pxPerSec,
    renderPxPerSec: zoom.renderPxPerSec,
    zoomPreviewActive: zoom.zoomPreviewActive,
    zoomIn: zoom.zoomIn,
    zoomOut: zoom.zoomOut,
    resetZoom: zoom.resetZoom,
    zoomToFitTier: zoom.zoomToFitTier,
    zoomToFitSelection: zoom.zoomToFitSelection,
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
