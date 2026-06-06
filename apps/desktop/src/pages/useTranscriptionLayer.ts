import { useCallback, useMemo, useRef, useState } from "react";
import { useSegmentKeyboard } from "../hooks/useSegmentKeyboard";
import { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import { useWaveformTierWheelForward } from "../hooks/useWaveformTierWheelForward";
import { p1LaneBoundsSignature } from "../utils/boundsSignature";
import { resolveWaveformSegmentContextMenuIndex } from "../utils/waveformSegmentContextMenu";
import {
  PX_PER_SEC_MAX,
  PX_PER_SEC_MIN,
  resolveWaveformZoomSliderRange,
} from "../utils/pxPerSec";
import { computeZoomInPxPerSec, computeZoomOutPxPerSec } from "../utils/waveformZoomSlider";
import { assignSegmentOverlapLanes, computeSegmentLaneRowPx } from "../utils/segmentLayout";
import { resolveSelectSegmentViewportPlan } from "../services/waveform/selectSegmentViewportPlan";
import { resolveWaveformFooterStatusLabel } from "../services/waveform/waveformRenderStatus";
import { parseMediaTimeInput, segmentStartSec } from "../utils/formatMediaTime";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import { shouldFocusWaveformShellForSelectSource, shouldFitSelectionOnWaveformSelect, shouldZoomViewportOnSelectSource } from "../utils/waveformViewMode";
export { TIMELINE_PX_PER_SEC, clampPxPerSec } from "../utils/pxPerSec";
export { computeSegmentLaneRowPx, assignSegmentOverlapLanes, computeTimelineWidthPx, SEGMENT_LANE_ROW_PX } from "../utils/segmentLayout";

export type TranscriptionLayerApi = ReturnType<typeof useTranscriptionLayer>;

import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

export type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

export function useTranscriptionLayer(ctx: TranscriptionLayerInput) {
  const segmentListRef = useRef<HTMLDivElement | null>(null);
  const waveformShellRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const timeline = useWaveformTimelineController(ctx);

  const setSelectedIdxUi = useCallback((idx: number) => {
    ctxRef.current.setSelectedIdx(idx);
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

  const scrollFitRef = useRef({ timeline });
  scrollFitRef.current = { timeline };

  const stepWaveformZoomRef = useRef<(direction: "in" | "out") => void>(() => {});
  stepWaveformZoomRef.current = (direction) => {
    const { timeline: tl } = scrollFitRef.current;
    const tier = tl.tierScrollRef.current;
    const dur = tl.timelineMetrics.mediaDurationSec;
    const vw = tier?.clientWidth ?? 0;
    const px = tl.pxPerSec;
    const sliderRange =
      vw > 0 && dur >= 0.5
        ? resolveWaveformZoomSliderRange(vw, dur)
        : { minPxPerSec: PX_PER_SEC_MIN, maxPxPerSec: PX_PER_SEC_MAX };
    const next =
      direction === "in"
        ? computeZoomInPxPerSec(px, sliderRange)
        : computeZoomOutPxPerSec(px, sliderRange);
    if (Math.abs(next - px) < 0.001) return;
    tl.zoom.setPxPerSecFromSlider(next);
  };

  const selectSegmentAtRef = useRef<(idx: number, source?: SegmentSelectSource) => void>(() => {});

  const keyboard = useSegmentKeyboard({
    ctxRef,
    wfApiRef: timeline.wfApiRef,
    selectSegmentAtRef,
    tierScrollRef: timeline.tierScrollRef,
    showEditorHintRef,
    stepWaveformZoomRef,
  });

  const segmentLaneRowPx = useMemo(
    () => computeSegmentLaneRowPx(timeline.display.transcriptFontPx),
    [timeline.display.transcriptFontPx],
  );

  const laneBoundsSig = p1LaneBoundsSignature(ctx.segments);
  const segmentLaneLayout = useMemo(() => {
    void laneBoundsSig;
    return assignSegmentOverlapLanes(
      ctxRef.current.segments,
      timeline.timelineMetrics.mediaDurationSec,
    );
  }, [laneBoundsSig, timeline.timelineMetrics.mediaDurationSec]);

  const focusWaveformShell = useCallback(() => {
    waveformShellRef.current?.focus();
  }, []);

  const openSegmentContextMenuFromPointer = useCallback(
    (input: {
      clientX: number;
      clientY: number;
      overlayClientTop: number;
      peaksPaintedHeightPx: number;
      layoutYScale: number;
    }) => {
      const c = ctxRef.current;
      if (c.busy || !c.onOpenSegmentContextMenu) return;
      const pointerTimeSec = timeline.wfApiRef.current.clientXToTimeSec(input.clientX);
      const segmentIdx = resolveWaveformSegmentContextMenuIndex({
        segments: c.segments,
        timeSec: pointerTimeSec,
        pointerClientY: input.clientY,
        overlayClientTop: input.overlayClientTop,
        layoutHeightPx: input.peaksPaintedHeightPx,
        layoutYScale: input.layoutYScale,
        laneByIndex: segmentLaneLayout.laneByIndex,
        laneCount: segmentLaneLayout.laneCount,
        selectedIdx: c.selectedIdx,
        durationSec: timeline.timelineMetrics.mediaDurationSec,
      });
      if (segmentIdx < 0) return;
      c.onOpenSegmentContextMenu({
        x: input.clientX,
        y: input.clientY,
        segmentIdx,
        pointerTimeSec,
        origin: "waveform",
      });
    },
    [segmentLaneLayout.laneByIndex, segmentLaneLayout.laneCount, timeline.wfApiRef],
  );

  const selectSegmentAt = useCallback(
    (idx: number, source: SegmentSelectSource = "waveform") => {
      const c = ctxRef.current;
      const s = c.segments[idx];
      if (!s) return;
      setSelectedIdxUi(idx);
      const plan = resolveSelectSegmentViewportPlan(s);
      const seg = plan.segment;
      if (shouldZoomViewportOnSelectSource(source)) {
        scrollFitRef.current.timeline.viewportFit.zoomToFitSegment({
          start_sec: seg.start_sec,
          end_sec: seg.end_sec,
        });
      } else if (
        shouldFitSelectionOnWaveformSelect(
          source,
          scrollFitRef.current.timeline.zoom.layoutIntentRef.current,
        )
      ) {
        scrollFitRef.current.timeline.viewportFit.zoomToFitSegment(
          { start_sec: seg.start_sec, end_sec: seg.end_sec },
          { forceFullFit: true },
        );
      } else {
        scrollFitRef.current.timeline.viewportFit.revealSegmentInViewport({
          start_sec: seg.start_sec,
          end_sec: seg.end_sec,
        });
      }
      requestAnimationFrame(() => {
        timeline.wfApiRef.current.seek(segmentStartSec(s));
      });
      if (shouldFocusWaveformShellForSelectSource(source)) {
        focusWaveformShell();
      }
    },
    [focusWaveformShell, setSelectedIdxUi, timeline.wfApiRef],
  );

  selectSegmentAtRef.current = selectSegmentAt;

  const jumpToMediaTime = useCallback(
    (raw: string) => {
      const dur = timeline.timelineMetrics.mediaDurationSec;
      const sec = parseMediaTimeInput(raw, dur > 0 ? dur : undefined);
      if (sec == null) {
        showEditorHintRef.current("时间格式无效，请用 m:ss 或 h:mm:ss。");
        return false;
      }
      timeline.wfApiRef.current.seek(sec);
      return true;
    },
    [timeline.timelineMetrics.mediaDurationSec, timeline.wfApiRef],
  );

  const { wf, display, peaks, zoom, routePrefs } = timeline;
  const waveformStageHeightPx = display.waveformHeightPx;
  const waveformPeaksPhase = timeline.waveformPeaksPhase;
  const waveformFooterStatusLabel = resolveWaveformFooterStatusLabel({
    phase: waveformPeaksPhase,
    backgroundPeaksEnabled: routePrefs.backgroundPeaksEnabled,
    mountDeferTimedOut: timeline.mountDeferTimedOut,
    waveformReady: wf.isReady,
  });

  useWaveformTierWheelForward({
    waveformShellRef,
    tierScrollRef: timeline.tierScrollRef,
    enabled: Boolean(ctx.mediaUrl && wf.isReady),
    onTierScroll: timeline.onTierScroll,
  });

  return {
    tierScrollRef: timeline.tierScrollRef,
    segmentListRef,
    waveformShellRef,
    editorHint,
    showEditorHint,
    clearWaveformPeaksCache: timeline.clearWaveformPeaksCache,
    waveformStageHeightPx,
    tierScrollLayout: timeline.tierScrollLayout,
    seekFromTierClientX: timeline.seekFromTierClientX,
    setTierScrollPx: timeline.setTierScrollPx,
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
    onTierScroll: timeline.onTierScroll,
    timelineWidthPx: timeline.timelineWidthPx,
    tierScrollLive: timeline.tierScrollLive,
    peaksLoading: peaks.loading,
    peakCache: peaks.peakCache,
    peakCacheGeneration: peaks.peakCacheGeneration,
    peaksUnavailable: peaks.peaksUnavailable,
    peaksError: peaks.error,
    exportMinimapPeaks: wf.exportMinimapPeaks,
    waveformPeaksPhase,
    waveformFooterStatusLabel,
    peaksHotSwitchPending: wf.peaksHotSwitchPending,
    backgroundPeaksEnabled: routePrefs.backgroundPeaksEnabled,
    minimapEnabled: routePrefs.minimapEnabled,
    setMinimapEnabled: routePrefs.setMinimapEnabled,
    hotSwitchWhilePlaying: routePrefs.hotSwitchWhilePlaying,
    mountDeferTimedOut: timeline.mountDeferTimedOut,
    currentTime: wf.currentTime,
    pxPerSec: timeline.pxPerSec,
    layoutIntent: timeline.layoutIntent,
    resetZoom: zoom.resetZoom,
    resetZoomForMedia: zoom.resetZoomForMedia,
    stepWaveformZoom: (direction: "in" | "out") => stepWaveformZoomRef.current(direction),
    zoomToFitSelection: timeline.viewportFit.zoomToFitSelection,
    zoomToFitAll: timeline.viewportFit.zoomToFitAll,
    setPxPerSecFromSlider: zoom.setPxPerSecFromSlider,
    selectSegmentAt,
    selectSegmentFromList: (idx: number) => selectSegmentAt(idx, "list"),
    jumpToMediaTime,
    insertSegmentAfter: ctx.insertSegmentAfter,
    deleteSegmentAt: ctx.deleteSegmentAt,
    splitAtPlayhead: ctx.splitAtPlayhead,
    focusWaveformShell,
    onWaveformMainKeyDown: keyboard.onWaveformMainKeyDown,
    onSegmentTextareaKeyDown: keyboard.onSegmentTextareaKeyDown,
    containerRef: wf.containerRef,
    waveformStickyShellRef: wf.stickyShellRef,
    waveformStretchShellRef: wf.stretchShellRef,
    waveformTimelineShellRef: wf.timelineShellRef,
    waveformPeaksStageShellRef: wf.peaksStageShellRef,
    isReady: wf.isReady,
    loadError: wf.loadError,
    isPlaying: wf.isPlaying,
    seek: wf.seek,
    togglePlay: wf.togglePlay,
    getPlayheadTime: wf.getPlayheadTime,
    clientXToTimeSec: wf.clientXToTimeSec,
    formatMediaTime: wf.formatMediaTime,
    globalPlaybackRate: wf.globalPlaybackRate,
    setGlobalPlaybackRate: wf.setGlobalPlaybackRate,
    segmentPlaybackRate: wf.segmentPlaybackRate,
    segmentLoopPlayback: wf.segmentLoopPlayback,
    handleSegmentPlaybackRateChange: wf.handleSegmentPlaybackRateChange,
    handleToggleSelectedWaveformLoop: wf.handleToggleSelectedWaveformLoop,
    handleToggleSelectedWaveformPlay: wf.handleToggleSelectedWaveformPlay,
    playSegmentAtIndex: wf.playSegmentAtIndex,
    mediaDurationSec: timeline.timelineMetrics.mediaDurationSec,
    /** @deprecated use mediaDurationSec — same layout duration truth */
    duration: timeline.timelineMetrics.mediaDurationSec,
    openSegmentContextMenuFromPointer,
  };
}
