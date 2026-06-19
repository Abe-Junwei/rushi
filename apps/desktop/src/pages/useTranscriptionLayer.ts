import { useCallback, useMemo, useRef, useState } from "react";
import { useSegmentKeyboard } from "../hooks/useSegmentKeyboard";
import { useEditorShortcutDispatcher } from "../hooks/useEditorShortcutDispatcher";
import { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import { useWaveformTierWheelForward } from "../hooks/useWaveformTierWheelForward";
import { computeSegmentLaneRowPx } from "../utils/segmentLayout";
import { resolveWaveformFooterStatusLabel } from "../services/waveform/waveformRenderStatus";
import { createEmptySegmentListFilterNavState } from "../utils/segmentListFilterNav";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";
import { useTranscriptionLayerSegmentListDrag } from "./useTranscriptionLayerSegmentListDrag";
import { useTranscriptionLayerSelection } from "./useTranscriptionLayerSelection";

export type TranscriptionLayerApi = ReturnType<typeof useTranscriptionLayer>;
export type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

export function useTranscriptionLayer(ctx: TranscriptionLayerInput) {
  const segmentListRef = useRef<HTMLDivElement | null>(null);
  const segmentListFilterNavRef = useRef(createEmptySegmentListFilterNavState());
  const waveformShellRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const timeline = useWaveformTimelineController(ctx);

  const setSelectedIdxUi = useCallback((idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => {
    ctxRef.current.selectSegmentAt(idx, opts);
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

  const selection = useTranscriptionLayerSelection({
    ctx,
    ctxRef,
    timeline,
    waveformShellRef,
    setSelectedIdxUi,
  });

  const segmentListDrag = useTranscriptionLayerSegmentListDrag({
    ctxRef,
    segmentListRef,
    selectSegmentAtRef: selection.selectSegmentAtRef,
  });

  const keyboard = useSegmentKeyboard({
    ctxRef,
    wfApiRef: timeline.wfApiRef,
    selectSegmentAtRef: selection.selectSegmentAtRef,
    segmentListRef,
    segmentListFilterNavRef,
  });
  const scheduleAdvanceToSegmentRef = useRef(keyboard.scheduleAdvanceToSegment);
  scheduleAdvanceToSegmentRef.current = keyboard.scheduleAdvanceToSegment;

  useEditorShortcutDispatcher({
    enabled: true,
    ctxRef,
    wfApiRef: timeline.wfApiRef,
    waveformShellRef,
    selectSegmentAtRef: selection.selectSegmentAtRef,
    focusSegmentTextarea: keyboard.focusSegmentTextarea,
    scheduleAdvanceToSegmentRef,
    showEditorHintRef,
    stepWaveformZoomRef: selection.stepWaveformZoomRef,
    segmentListFilterNavRef,
  });

  const segmentLaneRowPx = useMemo(
    () => computeSegmentLaneRowPx(timeline.display.transcriptFontPx),
    [timeline.display.transcriptFontPx],
  );

  const { wf, display, peaks, zoom, routePrefs } = timeline;
  const waveformStageHeightPx = display.waveformHeightPx;
  const waveformPeaksPhase = timeline.waveformPeaksPhase;
  const waveformFooterStatusLabel = resolveWaveformFooterStatusLabel({
    phase: waveformPeaksPhase,
    mountDeferTimedOut: timeline.mountDeferTimedOut,
    waveformReady: wf.isReady,
  });

  useWaveformTierWheelForward({
    waveformShellRef,
    tierScrollRef: timeline.tierScrollRef,
    enabled: Boolean(ctx.mediaUrl && wf.isReady),
    onTierScroll: timeline.onTierScroll,
  });

  /* eslint-disable react-hooks/exhaustive-deps -- selection is a stable controller object; only selectSegmentAt is used */
  const selectSegmentFromList = useCallback(
    (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => {
      selection.selectSegmentAt(idx, "list", opts);
    },
    [selection.selectSegmentAt],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  return {
    tierScrollRef: timeline.tierScrollRef,
    segmentListRef,
    segmentListFilterNavRef,
    waveformShellRef,
    editorHint,
    showEditorHint,
    clearWaveformPeaksCache: timeline.clearWaveformPeaksCache,
    waveformStageHeightPx,
    tierScrollLayout: timeline.tierScrollLayout,
    seekFromTierClientX: timeline.seekFromTierClientX,
    setTierScrollPx: timeline.setTierScrollPx,
    setTierScrollPxSmooth: timeline.setTierScrollPxSmooth,
    segmentLaneLayout: selection.segmentLaneLayout,
    lastSegmentSelectSourceRef: selection.lastSegmentSelectSourceRef,
    segmentLaneRowPx,
    waveformHeightPx: display.waveformHeightPx,
    waveformRenderHeightPx: display.waveformRenderHeightPx,
    waveformPaintedHeightPx: display.waveformPaintedHeightPx,
    waveformHeightDragging: display.waveformHeightDragging,
    transcriptFontPx: display.transcriptFontPx,
    transcriptRowHeightPx: display.transcriptRowHeightPx,
    nudgeWaveformHeight: display.nudgeWaveformHeight,
    nudgeTranscriptFontPx: display.nudgeTranscriptFontPx,
    setTranscriptFontPx: display.setTranscriptFontPx,
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
    minimapEnabled: routePrefs.minimapEnabled,
    setMinimapEnabled: routePrefs.setMinimapEnabled,
    playbackScrollFollowMode: routePrefs.playbackScrollFollowMode,
    setPlaybackScrollFollowMode: routePrefs.setPlaybackScrollFollowMode,
    hotSwitchWhilePlaying: routePrefs.hotSwitchWhilePlaying,
    mountDeferTimedOut: timeline.mountDeferTimedOut,
    currentTime: wf.currentTime,
    pxPerSec: timeline.pxPerSec,
    layoutIntent: timeline.layoutIntent,
    resetZoom: zoom.resetZoom,
    resetZoomForMedia: zoom.resetZoomForMedia,
    stepWaveformZoom: (direction: "in" | "out") => selection.stepWaveformZoomRef.current(direction),
    zoomToFitSelection: timeline.viewportFit.zoomToFitSelection,
    zoomToFitAll: timeline.viewportFit.zoomToFitAll,
    setPxPerSecFromSlider: zoom.setPxPerSecFromSlider,
    selectSegmentAt: selection.selectSegmentAt,
    selectSegmentFromList,
    selectSegmentRange: ctx.selectSegmentRange,
    selectionLo: ctx.selectionLo,
    selectionHi: ctx.selectionHi,
    selectionCount: ctx.selectionCount,
    isMultiSegmentSelection: ctx.isMultiSegmentSelection,
    isIndexInSelection: ctx.isIndexInSelection,
    onTimestampPointerDown: segmentListDrag.onTimestampPointerDown,
    onSegmentListRangePointerDown: segmentListDrag.onSegmentListRangePointerDown,
    consumeSegmentListRangeClickSuppress: segmentListDrag.consumeSegmentListRangeClickSuppress,
    revealSelectedSegmentInViewport: selection.revealSelectedSegmentInViewport,
    insertSegmentAfter: ctx.insertSegmentAfter,
    deleteSegmentAt: ctx.deleteSegmentAt,
    requestDeleteSelection: ctx.requestDeleteSelection,
    mergeSegmentRange: ctx.mergeSegmentRange,
    splitAtPlayhead: ctx.splitAtPlayhead,
    focusWaveformShell: selection.focusWaveformShell,
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
    segmentLoopPlayback: wf.segmentLoopPlayback,
    isSelectedSegmentPlaying: wf.isSelectedSegmentPlaying,
    handleToggleSelectedWaveformLoop: wf.handleToggleSelectedWaveformLoop,
    handleToggleSelectedWaveformPlay: wf.handleToggleSelectedWaveformPlay,
    playSegmentAtIndex: wf.playSegmentAtIndex,
    mediaDurationSec: timeline.timelineMetrics.mediaDurationSec,
    openSegmentContextMenuFromPointer: selection.openSegmentContextMenuFromPointer,
  };
}
