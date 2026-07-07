import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSegmentKeyboard } from "../hooks/useSegmentKeyboard";
import { useEditorShortcutDispatcher } from "../hooks/useEditorShortcutDispatcher";
import { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import { useWaveformTierWheelForward } from "../hooks/useWaveformTierWheelForward";
import { computeSegmentLaneRowPx } from "../utils/segmentLayout";
import { resolveWaveformFooterStatusLabel } from "../services/waveform/waveformRenderStatus";
import { createEmptySegmentListFilterNavState } from "../utils/segmentListFilterNav";
import type { SegmentSelectAtOptions } from "../utils/waveformViewMode";
import { nextListSelectSource } from "../utils/segmentListSelectSource";
import { normalizeSegmentIndexRange, rangeIndices } from "../utils/segmentSelection";
import { publishSelectionChromeForIndices } from "../services/selection/publishSelectionChromeForInput";
import {
  registerSelectionChromePublishRoots,
  publishSelectionChromeForControllerState,
  resetSelectionChromeForFile,
} from "../services/selection/selectionChromePublishBridge";
import { clearWaveformSegmentPreviewViewportSync } from "../services/waveform/waveformSegmentSelectPreviewSync";
import { clampSegmentIndex } from "../utils/segmentSelection";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";
import { useTranscriptionLayerSegmentListDrag } from "./useTranscriptionLayerSegmentListDrag";
import { useTranscriptionLayerSelection } from "./useTranscriptionLayerSelection";
import type { SegmentContextMenuOpen } from "../utils/segmentContextMenuModel";
import { applyContextMenuSelectionBeforeOpen } from "../services/selection/segmentContextMenuSelection";

export type TranscriptionLayerApi = ReturnType<typeof useTranscriptionLayer>;
export type { TranscriptionLayerInput } from "./transcriptionLayerTypes";

export function useTranscriptionLayer(ctx: TranscriptionLayerInput) {
  const segmentListRef = useRef<HTMLDivElement | null>(null);
  const segmentListFilterNavRef = useRef(createEmptySegmentListFilterNavState());
  const waveformShellRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const timeline = useWaveformTimelineController(ctx);

  const setSelectedIdxUi = useCallback((idx: number, opts?: SegmentSelectAtOptions) => {
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
    segmentListRef,
    setSelectedIdxUi,
    selectedIdxRef: ctx.selectedIdxRef,
    segmentListFilterNavRef,
    transcriptRowHeightPx: timeline.display.transcriptRowHeightPx,
  });

  const selectSegmentRangeRef = useRef<(lo: number, hi: number) => void>((lo, hi) => {
    ctxRef.current.selectSegmentRange(lo, hi);
  });

  const segmentListDrag = useTranscriptionLayerSegmentListDrag({
    ctxRef,
    segmentListRef,
    selectSegmentAtRef: selection.selectSegmentAtRef,
    selectSegmentRangeRef,
    lastSegmentSelectSourceRef: selection.lastSegmentSelectSourceRef,
  });

  const cancelPendingSelectionRevealRef = useRef(selection.cancelPendingSelectionReveal);
  cancelPendingSelectionRevealRef.current = selection.cancelPendingSelectionReveal;
  const finalizeListKeyboardViewportRef = useRef(selection.finalizeListKeyboardViewport);
  finalizeListKeyboardViewportRef.current = selection.finalizeListKeyboardViewport;
  const commitListKeyboardBurstRef = useRef(selection.commitListKeyboardBurst);
  commitListKeyboardBurstRef.current = selection.commitListKeyboardBurst;

  const keyboard = useSegmentKeyboard({
    ctxRef,
    wfApiRef: timeline.wfApiRef,
    selectSegmentAtRef: selection.selectSegmentAtRef,
    segmentListRef,
    segmentListFilterNavRef,
    cancelPendingSelectionRevealRef,
    finalizeListKeyboardViewportRef,
    commitListKeyboardBurstRef,
  });
  const scheduleAdvanceToSegmentRef = useRef(keyboard.scheduleAdvanceToSegment);
  scheduleAdvanceToSegmentRef.current = keyboard.scheduleAdvanceToSegment;

  useEditorShortcutDispatcher({
    enabled: true,
    ctxRef,
    wfApiRef: timeline.wfApiRef,
    waveformShellRef,
    tierScrollRef: timeline.tierScrollRef,
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
    onWheelScrollDelta: timeline.applyWheelScrollDelta,
    onCancelScrollMotion: () => timeline.cancelTransientScrollMotion("pointer"),
  });

  const seek = useCallback(
    (timeSec: number) => {
      wf.seek(timeSec);
      timeline.syncDisplayPlayheadAfterSeek(timeSec);
    },
    [timeline.syncDisplayPlayheadAfterSeek, wf.seek],
  );

  useLayoutEffect(() => {
    registerSelectionChromePublishRoots({
      getListRoot: () => segmentListRef.current,
      getOverlayRoot: () =>
        timeline.tierScrollRef.current?.querySelector(".waveform-timeline-overlay-layer") ?? null,
    });
    return () => registerSelectionChromePublishRoots(null);
  }, [segmentListRef, timeline.tierScrollRef]);

  useLayoutEffect(() => {
    resetSelectionChromeForFile(ctx.fileId);
    clearWaveformSegmentPreviewViewportSync();
    const c = ctxRef.current;
    if (!c.fileId || c.segments.length === 0) return;
    const primary = clampSegmentIndex(c.selectedIdx, c.segments.length);
    publishSelectionChromeForControllerState({
      fileId: c.fileId,
      segments: c.segments,
      primaryIdx: primary,
      selectedIndices: c.selectedIndicesArray.length > 0 ? c.selectedIndicesArray : [primary],
    });
  }, [ctx.fileId, ctx.segments.length]);

  /* eslint-disable react-hooks/exhaustive-deps -- selection is a stable controller object; only selectSegmentAt is used */
  const selectSegmentFromList = useCallback(
    (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => {
      const source = opts
        ? "list"
        : nextListSelectSource(Date.now(), segmentListDrag.listSelectSourceStateRef.current);
      selection.selectSegmentAt(idx, source, opts);
    },
    [segmentListDrag.listSelectSourceStateRef, selection.selectSegmentAt],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const resolveSelectionChromeRoots = useCallback(() => {
    const tier = timeline.tierScrollRef.current;
    return {
      listRoot: segmentListRef.current,
      overlayRoot: tier?.querySelector(".waveform-timeline-overlay-layer") ?? null,
    };
  }, [segmentListRef, timeline.tierScrollRef]);

  const selectSegmentIndicesWithChrome = useCallback(
    (indices: number[], primaryIdx: number) => {
      selection.lastSegmentSelectSourceRef.current = "multiSelect";
      publishSelectionChromeForIndices(
        ctxRef.current,
        indices,
        primaryIdx,
        resolveSelectionChromeRoots(),
      );
      ctxRef.current.selectSegmentIndices(indices, primaryIdx);
    },
    [resolveSelectionChromeRoots, selection.lastSegmentSelectSourceRef],
  );

  const selectSegmentRangeWithChrome = useCallback(
    (lo: number, hi: number) => {
      selection.lastSegmentSelectSourceRef.current = "multiSelect";
      const c = ctxRef.current;
      const normalized = normalizeSegmentIndexRange(lo, hi, c.segments.length);
      if (normalized) {
        publishSelectionChromeForIndices(
          c,
          [...rangeIndices(normalized.lo, normalized.hi)],
          normalized.hi,
          resolveSelectionChromeRoots(),
        );
      }
      c.selectSegmentRange(lo, hi);
    },
    [resolveSelectionChromeRoots, selection.lastSegmentSelectSourceRef],
  );

  selectSegmentRangeRef.current = selectSegmentRangeWithChrome;

  /* eslint-disable react-hooks/exhaustive-deps -- selection is a stable controller object; only selectSegmentAt is used */
  const openSegmentContextMenu = useCallback(
    (menu: SegmentContextMenuOpen) => {
      const c = ctxRef.current;
      applyContextMenuSelectionBeforeOpen(menu, c, (idx, source) => {
        selection.selectSegmentAt(idx, source);
      });
      c.onOpenSegmentContextMenu?.(menu);
    },
    [selection.selectSegmentAt],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const focusSegmentAfterWaveformCreate = useCallback((idx: number) => {
    selection.lastSegmentSelectSourceRef.current = "waveform";
    window.requestAnimationFrame(() => {
      keyboard.focusSegmentTextarea(idx);
    });
  }, [keyboard.focusSegmentTextarea, selection.lastSegmentSelectSourceRef]);

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
    centerTierAtClientX: timeline.centerTierAtClientX,
    setTierScrollPx: timeline.setTierScrollPx,
    userScrubScroll: timeline.userScrubScroll,
    minimapScrubScroll: timeline.minimapScrubScroll,
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
    dispatchWaveformSelectionGesture: selection.dispatchWaveformSelectionGesture,
    previewWaveformSegmentChrome: selection.previewWaveformSegmentChrome,
    selectSegmentFromList,
    selectSegmentRange: selectSegmentRangeWithChrome,
    selectSegmentIndices: selectSegmentIndicesWithChrome,
    selectionLo: ctx.selectionLo,
    selectionHi: ctx.selectionHi,
    selectionCount: ctx.selectionCount,
    isMultiSegmentSelection: ctx.isMultiSegmentSelection,
    isIndexInSelection: ctx.isIndexInSelection,
    onTimestampPointerDown: segmentListDrag.onTimestampPointerDown,
    onSegmentListRangePointerDown: segmentListDrag.onSegmentListRangePointerDown,
    consumeSegmentListRangeClickSuppress: segmentListDrag.consumeSegmentListRangeClickSuppress,
    revealSelectedSegmentInViewport: selection.revealSelectedSegmentInViewport,
    suppressPlaybackFollowForSelectionSeek: timeline.suppressPlaybackFollowForSelectionSeek,
    insertSegmentAfter: ctx.insertSegmentAfter,
    deleteSegmentAt: ctx.deleteSegmentAt,
    requestDeleteSelection: ctx.requestDeleteSelection,
    mergeSegmentRange: ctx.mergeSegmentRange,
    splitAtPlayhead: ctx.splitAtPlayhead,
    focusWaveformShell: selection.focusWaveformShell,
    onSegmentTextareaKeyDown: keyboard.onSegmentTextareaKeyDown,
    focusSegmentTextarea: keyboard.focusSegmentTextarea,
    focusSegmentAfterWaveformCreate,
    containerRef: wf.containerRef,
    waveformStickyShellRef: wf.stickyShellRef,
    waveformStretchShellRef: wf.stretchShellRef,
    waveformTimelineShellRef: wf.timelineShellRef,
    waveformPeaksStageShellRef: wf.peaksStageShellRef,
    isReady: wf.isReady,
    loadError: wf.loadError,
    isPlaying: wf.isPlaying,
    seek,
    togglePlay: wf.togglePlay,
    getPlayheadTime: wf.getPlayheadTime,
    getDisplayPlayheadTimeSec: timeline.getDisplayPlayheadTimeSec,
    subscribePlayheadFrame: timeline.subscribePlayheadFrame,
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
    openSegmentContextMenu,
  };
}
