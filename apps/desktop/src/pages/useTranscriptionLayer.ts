import { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import { useSegmentKeyboard } from "../hooks/useSegmentKeyboard";
import { useEditorShortcutDispatcher } from "../hooks/useEditorShortcutDispatcher";
import { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";
import { useWaveformTierWheelForward } from "../hooks/useWaveformTierWheelForward";
import { useTranscriptPlaybackFollow } from "../hooks/useTranscriptPlaybackFollow";
import { computeSegmentLaneRowPx } from "../utils/segmentLayout";
import { resolveWaveformFooterStatusLabel } from "../services/waveform/waveformRenderStatus";
import { createEmptySegmentListFilterNavState } from "../utils/segmentListFilterNav";
import { nextListSelectSource } from "../utils/segmentListSelectSource";
import { clearWaveformSegmentPreviewViewportSync } from "../services/waveform/waveformSegmentSelectPreviewSync";
import { isGlobalPlaybackSession } from "../utils/playbackSession";
import {
  registerFileViewStateCapture,
  captureFileViewStateNow,
  peekFileViewRestoreForFile,
} from "../services/fileViewStateBridge";
import { registerSegmentStructurePlaybackBridge } from "../services/segmentStructurePlaybackBridge";
import { writeFileViewState } from "../services/fileViewState";
import { logDesktopUi } from "../services/desktopUiLog";
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
  const timelineRef = useRef(timeline);
  timelineRef.current = timeline;

  useEffect(() => {
    registerFileViewStateCapture(() => {
      const c = ctxRef.current;
      const t = timelineRef.current;
      if (!c.fileId) return null;
      const idx = c.selectedIdxRef?.current ?? c.selectedIdx;
      const uid = c.segments[idx]?.uid ?? null;
      const scrollLeft =
        t.tierScrollRef.current?.scrollLeft ?? t.tierScrollLive.scrollLeftRef.current ?? 0;
      const displaySec = t.getDisplayPlayheadTimeSec();
      const decisionSec = t.wf.getPlayheadTime?.() ?? 0;
      const authoritySec = t.wf.getAuthorityPlayheadTimeSec?.() ?? 0;
      const stateSec = t.wf.currentTime ?? 0;
      // ADR-0008: bookmark the display/decision clock, not a lagging TimeUpdate latch.
      const playheadSec =
        displaySec > 0
          ? displaySec
          : decisionSec > 0
            ? decisionSec
            : authoritySec > 0
              ? authoritySec
              : stateSec;
      logDesktopUi(
        "INFO",
        `[fvsr] capture file=${c.fileId} playhead=${playheadSec.toFixed(2)} disp=${displaySec.toFixed(2)} decision=${decisionSec.toFixed(2)} auth=${authoritySec.toFixed(2)} state=${stateSec.toFixed(2)} scroll=${scrollLeft} px/s=${t.zoom.layoutPxPerSec}`,
      );
      return {
        // Prefer live engine/display time; React state only guards transient remount zeros.
        playheadSec,
        selectedSegmentUid: uid ?? null,
        tierScrollLeftPx: scrollLeft,
        layoutPxPerSec: t.zoom.layoutPxPerSec,
      };
    });
    // Mutations sit above the waveform tree — register playhead + sticky remap.
    registerSegmentStructurePlaybackBridge({
      getPlayheadSec: () => {
        const t = timelineRef.current;
        const displaySec = t.getDisplayPlayheadTimeSec?.() ?? 0;
        const decisionSec = t.wf.getPlayheadTime?.() ?? 0;
        return displaySec > 0 ? displaySec : decisionSec;
      },
      remapAfterStructureChange: (playheadSec, segments) =>
        timelineRef.current.wf.remapPlaybackAfterStructureChange?.(playheadSec, segments) ??
        -1,
    });
    return () => {
      registerFileViewStateCapture(null);
      registerSegmentStructurePlaybackBridge(null);
    };
  }, []);

  // Safety net: periodic persist so quit-without-gate / crash still leave a recent bookmark.
  useEffect(() => {
    if (!ctx.fileId) return;
    const fileId = ctx.fileId;
    const timer = window.setInterval(() => {
      const snap = captureFileViewStateNow();
      if (!snap) return;
      const id = ctxRef.current.fileId;
      if (!id || id !== fileId) return;
      if (peekFileViewRestoreForFile(id)) return;
      writeFileViewState(id, snap);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [ctx.fileId]);

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

  const { getPlaybackSession: wfGetPlaybackSession, playbackChromeEpoch: wfPlaybackChromeEpoch } =
    timeline.wf;
  const isGlobalPlaybackMode = useMemo(
    () => isGlobalPlaybackSession(wfGetPlaybackSession()),
    [wfGetPlaybackSession, wfPlaybackChromeEpoch],
  );

  const playbackFollow = useTranscriptPlaybackFollow({
    isPlaying: timeline.wf.isPlaying,
    isReady: timeline.wf.isReady,
    isGlobalPlaybackMode,
    segments: ctx.segments,
    selectedIdx: ctx.selectedIdx,
    subscribePlayheadFrame: timeline.subscribePlayheadFrame,
  });

  const selection = useTranscriptionLayerSelection({
    ctx,
    ctxRef,
    timeline,
    waveformShellRef,
    segmentListRef,
    selectedIdxRef: ctx.selectedIdxRef,
    segmentListFilterNavRef,
    transcriptRowHeightPx: timeline.display.transcriptRowHeightPx,
    onListLikeSegmentSelect: playbackFollow.notifyUserSegmentSelect,
    beginGlobalPlayback: (idx?: number) => {
      timeline.wf.clearBlankGlobalSpaceArm();
      if (
        typeof idx === "number" &&
        timeline.wf.isSegmentPlaybackSession?.()
      ) {
        // Sticky segment session + listen-jump → open segment play for the new sentence.
        queueMicrotask(() => {
          void timeline.wf.playSegmentAtIndex(idx);
        });
        return;
      }
      timeline.wf.beginGlobalPlayback();
    },
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
    peaksError: peaks.error,
    peakCache: peaks.peakCache,
    mediaDurationSec: timeline.timelineMetrics.mediaDurationSec,
  });

  useWaveformTierWheelForward({
    waveformShellRef,
    tierScrollRef: timeline.tierScrollRef,
    enabled: Boolean(ctx.mediaUrl && wf.isReady),
    onWheelScrollDelta: timeline.applyWheelScrollDelta,
    onCancelScrollMotion: () => timeline.cancelTransientScrollMotion("pointer"),
  });

  const seek = useCallback((timeSec: number) => {
    wf.seek(timeSec);
  }, [wf.seek]);

  const seekBlankToTime = useCallback((timeSec: number) => {
    wf.seekBlankToTime(timeSec);
  }, [wf.seekBlankToTime]);

  useLayoutEffect(() => {
    clearWaveformSegmentPreviewViewportSync();
  }, [ctx.fileId, ctx.segments.length]);

  /* eslint-disable react-hooks/exhaustive-deps -- selection is a stable controller object; only selectSegmentAt is used */
  const selectSegmentFromList = useCallback(
    (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean; forceSeek?: boolean }) => {
      const source = opts
        ? "list"
        : nextListSelectSource(Date.now(), segmentListDrag.listSelectSourceStateRef.current);
      selection.selectSegmentAt(idx, source, opts);
    },
    [segmentListDrag.listSelectSourceStateRef, selection.selectSegmentAt],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const selectSegmentIndicesWithChrome = useCallback(
    (indices: number[], primaryIdx: number) => {
      timeline.wf.clearBlankGlobalSpaceArm();
      selection.lastSegmentSelectSourceRef.current = "multiSelect";
      ctxRef.current.selectSegmentIndices(indices, primaryIdx);
    },
    [selection.lastSegmentSelectSourceRef, timeline.wf],
  );

  const selectSegmentRangeWithChrome = useCallback(
    (lo: number, hi: number) => {
      timeline.wf.clearBlankGlobalSpaceArm();
      selection.lastSegmentSelectSourceRef.current = "multiSelect";
      ctxRef.current.selectSegmentRange(lo, hi);
    },
    [selection.lastSegmentSelectSourceRef, timeline.wf],
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
    timeline.wf.clearBlankGlobalSpaceArm();
    selection.lastSegmentSelectSourceRef.current = "waveform";
    window.requestAnimationFrame(() => {
      keyboard.focusSegmentTextarea(idx);
    });
  }, [keyboard.focusSegmentTextarea, selection.lastSegmentSelectSourceRef, timeline.wf]);

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
    beginTranscriptRowHeightDragFromDom: display.beginTranscriptRowHeightDragFromDom,
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
    drawPxPerSec: zoom.drawPxPerSec,
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
    seekBlankToTime,
    togglePlay: wf.togglePlay,
    toggleGlobalPlay: wf.toggleGlobalPlay,
    getPlayheadTime: wf.getPlayheadTime,
    getDisplayPlayheadTimeSec: timeline.getDisplayPlayheadTimeSec,
    subscribePlayheadFrame: timeline.subscribePlayheadFrame,
    clientXToTimeSec: wf.clientXToTimeSec,
    formatMediaTime: wf.formatMediaTime,
    globalPlaybackRate: wf.globalPlaybackRate,
    setGlobalPlaybackRate: wf.setGlobalPlaybackRate,
    segmentLoopPlayback: wf.segmentLoopPlayback,
    isSelectedSegmentPlaying: wf.isSelectedSegmentPlaying,
    playheadChromeMode: wf.playheadChromeMode,
    handleToggleSelectedWaveformLoop: wf.handleToggleSelectedWaveformLoop,
    handleToggleSelectedWaveformPlay: wf.handleToggleSelectedWaveformPlay,
    playSegmentAtIndex: wf.playSegmentAtIndex,
    preserveLoopForNextSegmentSelect: wf.preserveLoopForNextSegmentSelect,
    mediaDurationSec: timeline.timelineMetrics.mediaDurationSec,
    openSegmentContextMenuFromPointer: selection.openSegmentContextMenuFromPointer,
    openSegmentContextMenu,
  };
}
