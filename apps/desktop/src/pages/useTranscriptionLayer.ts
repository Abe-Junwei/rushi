import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProjectWaveform } from "../hooks/useProjectWaveform";
import type { useProjectWaveform as UseProjectWaveformHook } from "../hooks/useProjectWaveform";

type WfApi = ReturnType<typeof UseProjectWaveformHook>;
import { useSegmentKeyboard } from "../hooks/useSegmentKeyboard";
import { useTierScrollSync } from "../hooks/useTierScrollSync";
import { useWaveformDisplay } from "../hooks/useWaveformDisplay";
import { useWaveformPeaks } from "../hooks/useWaveformPeaks";
import { useWaveformZoom } from "../hooks/useWaveformZoom";
import { useWaveformEditorPrefs } from "../hooks/useWaveformEditorPrefs";
import { p1LaneBoundsSignature } from "../utils/boundsSignature";
import { computeSelectionFitScrollPx } from "../utils/pxPerSec";
import { computeTimelineWidthPx } from "../utils/segmentLayout";
import { assignSegmentOverlapLanes, computeSegmentLaneRowPx } from "../utils/segmentLayout";
import { useTranscriptionViewportFit } from "./useTranscriptionViewportFit";
import { resolveSelectSegmentViewportPlan } from "../services/waveform/selectSegmentViewportPlan";
import { parseMediaTimeInput, segmentStartSec } from "../utils/formatMediaTime";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import { shouldFocusWaveformShellForSelectSource } from "../utils/waveformViewMode";
import { formatWaveformNavigationFooterLabel } from "../utils/waveformNavigationMode";
import { writeStoredWaveformPxPerSecDefault } from "../utils/waveformPrefs";

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

  const editorPrefs = useWaveformEditorPrefs(ctx.mediaUrl);
  const autoFitSelectionRef = useRef(editorPrefs.autoFitSelectionToViewport);
  autoFitSelectionRef.current = editorPrefs.autoFitSelectionToViewport;

  const setSelectedIdxUi = useCallback((idx: number) => {
    ctxRef.current.setSelectedIdx(idx);
  }, []);

  const display = useWaveformDisplay({ busy: ctx.busy });
  const peaks = useWaveformPeaks(ctx.projectId, ctx.mediaUrl ? ctx.fileId : null);

  useEffect(() => {
    if (peaks.peakCache) {
      setPeaksRepaintKey((k) => k + 1);
    }
  }, [peaks.peakCache]);

  const durationRef = useRef(0);
  const syncWaveformScrollRef = useRef<(scrollLeftPx: number) => void>(() => {});
  const scrollApiRef = useRef({ setTierScrollPx: (_scrollLeftPx: number) => {} });
  const wfApiRef = useRef<WfApi>(null!);
  const onWaveformScrollRef = useRef<(scrollLeftPx: number) => void>(() => {});
  const suppressWaveformScrollUntilRef = useRef(0);

  const zoom = useWaveformZoom();

  const applyPendingViewportFitRef = useRef<(pxPerSec: number, options?: { finalize?: boolean }) => boolean>(
    () => false,
  );

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
    onWaveformCreateRange: ctx.insertSegmentFromTimeRange,
    onWaveformScroll: (scrollLeftPx) => onWaveformScrollRef.current(scrollLeftPx),
    getViewportScrollPx: () => tierScrollRef.current?.scrollLeft ?? 0,
    onZoomApplied: (pxPerSec) => applyPendingViewportFitRef.current(pxPerSec, { finalize: true }),
  });

  durationRef.current = wf.duration || 0;
  wfApiRef.current = wf;

  const timelineWidthPx = useMemo(
    () => computeTimelineWidthPx(wf.duration || peaks.status?.durationSec || 0, zoom.pxPerSec),
    [wf.duration, peaks.status?.durationSec, zoom.pxPerSec],
  );

  const waveformNavigationFooterLabel = useMemo(
    () =>
      formatWaveformNavigationFooterLabel({
        autoFitSelectionToViewport: editorPrefs.autoFitSelectionToViewport,
      }),
    [editorPrefs.autoFitSelectionToViewport],
  );

  const prevMediaUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ctx.mediaUrl) {
      prevMediaUrlRef.current = null;
      return;
    }
    if (prevMediaUrlRef.current !== null && prevMediaUrlRef.current !== ctx.mediaUrl) {
      zoom.resetZoom();
      writeStoredWaveformPxPerSecDefault();
    }
    prevMediaUrlRef.current = ctx.mediaUrl;
  }, [ctx.mediaUrl, zoom]);

  const pxPerSecRef = useRef(zoom.pxPerSec);
  pxPerSecRef.current = zoom.pxPerSec;

  const [peaksRepaintKey, setPeaksRepaintKey] = useState(0);
  // Stable callback — passing an inline arrow to `useTranscriptionViewportFit`
  // would re-create `applyPendingViewportFit` every render, which is wired into
  // a `useLayoutEffect` dep array. That re-runs the effect on every render and,
  // if a pending fit exists, sets state from inside the layout effect — which
  // React 19 flushes synchronously and triggers "Maximum update depth exceeded".
  const handleTierScrollAdjusted = useCallback(() => {
    setPeaksRepaintKey((k) => k + 1);
  }, []);
  const [editorHint, setEditorHint] = useState("");
  const editorHintTimerRef = useRef(0);
  const showEditorHint = useCallback((msg: string) => {
    window.clearTimeout(editorHintTimerRef.current);
    setEditorHint(msg);
    editorHintTimerRef.current = window.setTimeout(() => {
      setEditorHint((prev) => (prev === msg ? "" : prev));
    }, 2400);
  }, []);
  const showEditorHintRef = useRef(showEditorHint);
  showEditorHintRef.current = showEditorHint;

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
    currentPxPerSecRef: pxPerSecRef,
    renderTimelineWidthPx: timelineWidthPx,
    waveformReady: wf.isReady,
    mediaUrl: ctx.mediaUrl,
    getSelectedSegment: () => ctx.segments[ctx.selectedIdx] ?? null,
    suppressWaveformScrollUntilRef,
    onTierScrollAdjusted: handleTierScrollAdjusted,
  });
  onWaveformScrollRef.current = viewportFit.onWaveformScroll;
  applyPendingViewportFitRef.current = (pxPerSec, options) => {
    const applied = viewportFit.applyPendingViewportFit(pxPerSec, options);
    if (applied) setPeaksRepaintKey((k) => k + 1);
    return applied;
  };

  const enterManualWaveformNavigation = useCallback(() => {
    viewportFit.cancelViewportFit();
    editorPrefs.setAutoFitSelectionToViewport(false);
  }, [editorPrefs, viewportFit]);

  const enterFollowWaveformNavigation = useCallback(() => {
    editorPrefs.setAutoFitSelectionToViewport(true);
    const seg = ctxRef.current.segments[ctxRef.current.selectedIdx];
    if (seg) {
      viewportFit.zoomToFitSegment(
        { start_sec: seg.start_sec, end_sec: seg.end_sec },
        { forceFullFit: false },
      );
    }
  }, [editorPrefs, viewportFit]);

  const refitFollowWaveformSelection = useCallback(() => {
    const seg = ctxRef.current.segments[ctxRef.current.selectedIdx];
    if (!seg) return;
    viewportFit.zoomToFitSegment(
      { start_sec: seg.start_sec, end_sec: seg.end_sec },
      { forceFullFit: false },
    );
  }, [viewportFit]);

  const selectSegmentAtRef = useRef<(idx: number, source?: SegmentSelectSource) => void>(() => {});

  const scrollFitRef = useRef({ scroll, viewportFit });
  scrollFitRef.current = { scroll, viewportFit };

  const keyboard = useSegmentKeyboard({
    ctxRef,
    wfApiRef,
    selectSegmentAtRef,
    tierScrollRef,
    showEditorHintRef,
  });

  const segmentLaneRowPx = useMemo(() => computeSegmentLaneRowPx(display.transcriptFontPx), [display.transcriptFontPx]);

  const laneBoundsSig = p1LaneBoundsSignature(ctx.segments);
  const segmentLaneLayout = useMemo(() => {
    void laneBoundsSig;
    return assignSegmentOverlapLanes(ctxRef.current.segments);
  }, [laneBoundsSig]);

  const focusWaveformShell = useCallback(() => {
    waveformShellRef.current?.focus();
  }, []);

  const scrollSegmentIntoWaveformViewport = useCallback(
    (idx: number) => {
      const c = ctxRef.current;
      const s = c.segments[idx];
      const tier = tierScrollRef.current;
      if (!s || !tier || tier.clientWidth <= 0) return;
      const px = zoom.pxPerSec;
      const dur = wfApiRef.current.duration || durationRef.current || 0;
      const tw = computeTimelineWidthPx(dur, px);
      const targetSl = computeSelectionFitScrollPx({
        viewportWidthPx: tier.clientWidth,
        timelineWidthPx: tw,
        pxPerSec: px,
        startSec: s.start_sec,
        endSec: s.end_sec,
      });
      const currentSl = tier.scrollLeft;
      viewportFit.markProgrammaticScroll(undefined, Math.abs(targetSl - currentSl));
      scrollApiRef.current.setTierScrollPx(targetSl);
    },
    [viewportFit, zoom.pxPerSec],
  );

  const selectSegmentAt = useCallback(
    (idx: number, source: SegmentSelectSource = "waveform") => {
      const c = ctxRef.current;
      const s = c.segments[idx];
      if (!s) return;
      setSelectedIdxUi(idx);
      const plan = resolveSelectSegmentViewportPlan(autoFitSelectionRef.current, s);
      if (plan.kind === "fit") {
        scrollFitRef.current.viewportFit.zoomToFitSegment({
          start_sec: plan.segment.start_sec,
          end_sec: plan.segment.end_sec,
        });
      } else {
        requestAnimationFrame(() => {
          scrollSegmentIntoWaveformViewport(idx);
        });
      }
      requestAnimationFrame(() => {
        wfApiRef.current.seek(segmentStartSec(s));
      });
      if (shouldFocusWaveformShellForSelectSource(source)) {
        focusWaveformShell();
      }
    },
    [focusWaveformShell, scrollSegmentIntoWaveformViewport, setSelectedIdxUi],
  );

  selectSegmentAtRef.current = selectSegmentAt;

  const jumpToMediaTime = useCallback(
    (raw: string) => {
      const dur = wfApiRef.current.duration || durationRef.current || 0;
      const sec = parseMediaTimeInput(raw, dur > 0 ? dur : undefined);
      if (sec == null) {
        showEditorHintRef.current("时间格式无效，请用 m:ss 或 h:mm:ss。");
        return false;
      }
      wfApiRef.current.seek(sec);
      return true;
    },
    [],
  );

  const waveformStageHeightPx = display.waveformHeightPx;

  return {
    tierScrollRef,
    segmentListRef,
    waveformShellRef,
    autoFitSelectionToViewport: editorPrefs.autoFitSelectionToViewport,
    setAutoFitSelectionToViewport: editorPrefs.setAutoFitSelectionToViewport,
    enterManualWaveformNavigation,
    enterFollowWaveformNavigation,
    refitFollowWaveformSelection,
    globalStripCollapsed: editorPrefs.globalStripCollapsed,
    toggleGlobalStripCollapsed: editorPrefs.toggleGlobalStripCollapsed,
    editorHint,
    waveformNavigationFooterLabel,
    waveformStageHeightPx,
    tierScrollLayout: scroll.tierScrollLayout,
    seekFromTierClientX: scroll.seekFromTierClientX,
    setTierScrollPx: scroll.setTierScrollPx,
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
    peaksRepaintKey,
    pxPerSec: zoom.pxPerSec,
    renderPxPerSec: zoom.renderPxPerSec,
    zoomPreviewActive: zoom.zoomPreviewActive,
    zoomDragging: zoom.zoomDragging,
    zoomIn: zoom.zoomIn,
    zoomOut: zoom.zoomOut,
    resetZoom: zoom.resetZoom,
    zoomToFitSelection: viewportFit.zoomToFitSelection,
    setPxPerSec: zoom.setPxPerSec,
    beginZoomInteraction: zoom.beginZoomInteraction,
    commitZoomInteraction: zoom.commitZoomInteraction,
    selectSegmentAt,
    selectSegmentFromList: (idx: number) => selectSegmentAt(idx, "list"),
    jumpToMediaTime,
    insertSegmentAfter: ctx.insertSegmentAfter,
    deleteSegmentAt: ctx.deleteSegmentAt,
    splitAtPlayhead: ctx.splitAtPlayhead,
    focusWaveformShell,
    onWaveformMainKeyDown: keyboard.onWaveformMainKeyDown,
    onSegmentTextareaKeyDown: keyboard.onSegmentTextareaKeyDown,
    ...wf,
  };
}
