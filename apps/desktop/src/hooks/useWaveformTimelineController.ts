import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useProjectWaveform } from "./useProjectWaveform";
import type { useProjectWaveform as UseProjectWaveformHook } from "./useProjectWaveform";
import { useTierScrollSync } from "./useTierScrollSync";
import { useWaveformPlaybackScrollFollow } from "./useWaveformPlaybackScrollFollow";
import { useWaveformEditorRoutePrefs } from "./useWaveformEditorRoutePrefs";
import { useWaveformDisplay } from "./useWaveformDisplay";
import { useWaveformPeaks } from "./useWaveformPeaks";
import { useWaveformZoom } from "./useWaveformZoom";
import { clampPxPerSecForWaveSurferRender } from "../utils/pxPerSec";
import { resolveFitAllPxPerSecAdjustment } from "../utils/waveformZoomBarState";
import { resolveWaveformTimelineMetrics } from "../utils/waveformTimelineMetrics";
import { useTranscriptionViewportFit } from "../pages/useTranscriptionViewportFit";
import {
  selectionSeekChromeSuppressUntil,
} from "../utils/waveformSelectionSeekChrome";
import { useWaveformTimelineMountGate } from "./useWaveformTimelineMountGate";
import { useWaveformTimelineDurationSync } from "./useWaveformTimelineDuration";
import { useWaveformPeaksPhaseState } from "./useWaveformPeaksPhaseState";
import { useWaveformVisualPlayheadClock } from "./useWaveformVisualPlayheadClock";
import { WAVEFORM_BACKGROUND_PEAKS_ENABLED } from "../utils/waveformPrefs";
import { useWaveformMediaZoomResetEffect } from "./useWaveformMediaZoomResetEffect";
import { scheduleTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";

type WfApi = ReturnType<typeof UseProjectWaveformHook>;

/** Waveform timeline: zoom, scroll, peaks, viewport fit (ADR-0005). */
export function useWaveformTimelineController(ctx: TranscriptionLayerInput) {
  const tierScrollRef = useRef<HTMLDivElement | null>(null);
  const durationRef = useRef(0);
  const timelineWidthPxRef = useRef(0);
  const pxPerSecRef = useRef(56);
  const scrollApiRef = useRef({
    revealSelectionScroll: (_scrollLeftPx: number, _options?: { timelineWidthPx?: number }) => {},
  });
  const wfApiRef = useRef<WfApi>(null!);
  const playbackFollowSuppressUntilRef = useRef(0);
  const selectionSeekChromeSuppressUntilRef = useRef(0);
  const suppressPlaybackFollowForSelectionSeek = () => {
    const until = selectionSeekChromeSuppressUntil(performance.now());
    playbackFollowSuppressUntilRef.current = until;
    selectionSeekChromeSuppressUntilRef.current = until;
  };
  const applyPendingViewportFitRef = useRef<(pxPerSec: number, options?: { finalize?: boolean }) => boolean>(
    () => false,
  );

  const display = useWaveformDisplay({ busy: ctx.busy });
  const routePrefs = useWaveformEditorRoutePrefs();
  const zoom = useWaveformZoom();
  const [resolvedDurationSec, setResolvedDurationSec] = useState(0);
  const peaks = useWaveformPeaks(
    ctx.projectId,
    ctx.mediaUrl ? ctx.fileId : null,
    resolvedDurationSec,
    WAVEFORM_BACKGROUND_PEAKS_ENABLED,
    ctx.mediaUrl,
  );

  const mountMediaDurationSec = resolvedDurationSec || peaks.status?.durationSec || 0;

  const refitFitAllPxPerSecRef = useRef<(viewportWidthPx: number) => number | null>(() => null);
  const onAfterViewportResizeRef = useRef<(() => void) | undefined>(undefined);

  const { deferDecodeMount, mountDeferTimedOut } = useWaveformTimelineMountGate({
    mediaUrl: ctx.mediaUrl,
    mediaDurationSec: mountMediaDurationSec,
    backgroundPeaksEnabled: WAVEFORM_BACKGROUND_PEAKS_ENABLED,
    peaksLoading: peaks.loading,
    peakCache: peaks.peakCache,
    peaksUnavailable: peaks.peaksUnavailable,
  });

  const wf = useProjectWaveform({
    mediaUrl: ctx.mediaUrl,
    mediaDiskPath: ctx.mediaDiskPath,
    segments: ctx.segments,
    selectedIdx: ctx.selectedIdx,
    disabled: ctx.busy,
    layoutPxPerSec: zoom.layoutPxPerSec,
    drawPxPerSec: zoom.drawPxPerSec,
    peakCache: peaks.peakCache,
    peakCacheGeneration: peaks.peakCacheGeneration,
    deferDecodeMount,
    onAfterViewportResizeRef,
    waveformHeightPx: display.waveformRenderHeightPx,
    onWaveformHeightApplied: display.markWaveformRenderHeightApplied,
    onWaveformCreateRange: ctx.insertSegmentFromTimeRange,
    hotSwitchWhilePlaying: routePrefs.hotSwitchWhilePlaying,
    layoutDurationSecRef: durationRef,
    layoutTimelineWidthPxRef: timelineWidthPxRef,
    layoutDurationSec: resolvedDurationSec || mountMediaDurationSec,
    tierScrollRef,
    selectionSeekChromeSuppressUntilRef,
    refitFitAllPxPerSec: (viewportWidthPx) => refitFitAllPxPerSecRef.current(viewportWidthPx),
    onFitAllPxPerSecRefit: zoom.applyFitAllRefitPxPerSec,
    onZoomApplied: (pxPerSec) =>
      applyPendingViewportFitRef.current(pxPerSec, { finalize: true }),
  });

  wfApiRef.current = wf;

  const syncShellLayoutForZoomRef = useRef(wf.syncShellLayoutForZoom);
  syncShellLayoutForZoomRef.current = wf.syncShellLayoutForZoom;
  const refitFitAllIfNeededRef = useRef(wf.refitFitAllIfNeeded);
  refitFitAllIfNeededRef.current = wf.refitFitAllIfNeeded;
  const resetZoomForMediaRef = useRef(zoom.resetZoomForMedia);
  resetZoomForMediaRef.current = zoom.resetZoomForMedia;

  useWaveformTimelineDurationSync({
    setResolvedDurationSec,
    projectId: ctx.projectId,
    fileId: ctx.fileId,
    mediaUrl: ctx.mediaUrl,
    wfDuration: wf.duration,
    wfIsReady: wf.isReady,
    peaksStatusDurationSec: peaks.status?.durationSec ?? 0,
    peakCache: peaks.peakCache,
  });

  const timelineMetrics = useMemo(
    () =>
      resolveWaveformTimelineMetrics({
        wsDurationSec: wf.duration,
        peaksStatusDurationSec: peaks.status?.durationSec ?? peaks.peakCache?.durationSec ?? 0,
        pxPerSec: zoom.pxPerSec,
      }),
    [zoom.pxPerSec, peaks.status?.durationSec, peaks.peakCache, wf.duration],
  );

  const { timelineWidthPx } = timelineMetrics;

  refitFitAllPxPerSecRef.current = (viewportWidthPx) => {
    const dur = durationRef.current || timelineMetrics.mediaDurationSec;
    if (dur <= 0) return null;
    const intent = zoom.layoutIntentRef.current;
    return resolveFitAllPxPerSecAdjustment(viewportWidthPx, dur, pxPerSecRef.current, {
      layoutIntent: intent === "fit-all" ? "fit-all" : undefined,
      staleFitAllOnViewportGrow: intent !== "fit-all",
    });
  };

  const pxPerSec = zoom.pxPerSec;

  const visualPlayheadClock = useWaveformVisualPlayheadClock({
    isPlaying: wf.isPlaying,
    isReady: wf.isReady,
    durationSec: timelineMetrics.mediaDurationSec,
    currentTimeSec: wf.currentTime,
    playbackRate: wf.globalPlaybackRate,
    getPlayheadTime: wf.getPlayheadTime,
  });

  const scroll = useTierScrollSync({
    tierScrollRef,
    timelineWidthPx,
    mediaDurationSec: timelineMetrics.mediaDurationSec,
    pxPerSec,
    wfApiRef,
    waveformReady: wf.isReady,
    mediaUrl: ctx.mediaUrl,
    playbackFollowSuppressUntilRef,
  });

  onAfterViewportResizeRef.current = () => {
    scroll.refreshTierScrollLayout();
    wf.flushDeferredPeaksLoad();
    scheduleTierScrollFrame();
  };

  useLayoutEffect(() => {
    pxPerSecRef.current = zoom.pxPerSec;
    durationRef.current = resolvedDurationSec || timelineMetrics.mediaDurationSec || 0;
    timelineWidthPxRef.current = timelineWidthPx;
  }, [zoom.pxPerSec, resolvedDurationSec, timelineMetrics.mediaDurationSec, timelineWidthPx]);

  useLayoutEffect(() => {
    if (timelineWidthPx <= 0) return;
    syncShellLayoutForZoomRef.current();
  }, [timelineWidthPx]);

  /* eslint-disable react-hooks/exhaustive-deps -- zoom is a stable waveform controller object; we list used primitive fields/methods */
  useLayoutEffect(() => {
    if (timelineMetrics.mediaDurationSec <= 0) return;
    refitFitAllIfNeededRef.current();
    const dur = timelineMetrics.mediaDurationSec;
    const renderCap = clampPxPerSecForWaveSurferRender(zoom.pxPerSec, dur);
    const renderTol = Math.max(0.001, Math.min(renderCap * 0.05, 8));
    if (zoom.pxPerSec > renderCap + renderTol) {
      // Preserve fit-selection / fit-all / default intent — not a manual slider change.
      zoom.applyFitAllRefitPxPerSec(renderCap);
    }
  }, [
    timelineMetrics.mediaDurationSec,
    scroll.tierScrollLayout.clientWidthPx,
    zoom.applyFitAllRefitPxPerSec,
    zoom.layoutIntent,
    zoom.pxPerSec,
    peaks.peakCache,
    wf.duration,
    wf.isReady,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useWaveformPlaybackScrollFollow({
    tierScrollRef,
    timelineWidthPx,
    durationSec: timelineMetrics.mediaDurationSec,
    isPlaying: wf.isPlaying,
    isReady: wf.isReady,
    enabled: Boolean(ctx.mediaUrl && wf.isReady),
    followMode: routePrefs.playbackScrollFollowMode,
    getPlayheadTimeSec: visualPlayheadClock.getVisualPlayheadTimeSec,
    playbackFollowScroll: scroll.playbackFollowScroll,
    userScrollSuppressUntilRef: playbackFollowSuppressUntilRef,
    subscribePlayheadFrame: visualPlayheadClock.subscribePlayheadFrame,
  });

  /* eslint-disable react-hooks/exhaustive-deps -- scroll is a stable tier-scroll controller object; only refreshTierScrollLayout is used */
  useEffect(() => {
    if (wf.isPlaying) return;
    scroll.refreshTierScrollLayout();
  }, [scroll.refreshTierScrollLayout, wf.isPlaying]);
  /* eslint-enable react-hooks/exhaustive-deps */

  scrollApiRef.current = scroll;

  const viewportFit = useTranscriptionViewportFit({
    tierScrollRef,
    durationRef,
    scrollApiRef,
    wfApiRef,
    zoom,
    currentPxPerSec: pxPerSec,
    currentPxPerSecRef: pxPerSecRef,
    waveformReady: wf.isReady,
    mediaUrl: ctx.mediaUrl,
    getSelectedSegment: () => ctx.segments[ctx.selectedIdx] ?? null,
    playbackFollowSuppressUntilRef,
  });

  applyPendingViewportFitRef.current = viewportFit.applyPendingViewportFit;

  const waveformPeaksPhase = useWaveformPeaksPhaseState({
    mediaUrl: ctx.mediaUrl,
    peaksLoading: peaks.loading,
    peakCache: peaks.peakCache,
    peaksUnavailable: peaks.peaksUnavailable,
    peaksApplied: wf.peaksApplied,
    peaksHotSwitchPending: wf.peaksHotSwitchPending,
    waveformReady: wf.isReady,
    backgroundPeaksEnabled: WAVEFORM_BACKGROUND_PEAKS_ENABLED,
    mountDeferred: deferDecodeMount,
  });

  useWaveformMediaZoomResetEffect({
    mediaUrl: ctx.mediaUrl,
    mediaDurationSec: timelineMetrics.mediaDurationSec,
    tierScrollRef,
    tierScrollLive: scroll.tierScrollLive,
    tierScrollLayout: scroll.tierScrollLayout,
    resetZoomForMedia: (viewportWidthPx, durationSec) => resetZoomForMediaRef.current(viewportWidthPx, durationSec),
  });

  return {
    tierScrollRef,
    display,
    peaks,
    zoom,
    wf,
    wfApiRef,
    durationRef,
    scroll,
    viewportFit,
    resolvedDurationSec,
    timelineMetrics,
    timelineWidthPx,
    pxPerSec,
    layoutIntent: zoom.layoutIntent,
    tierScrollLayout: scroll.tierScrollLayout,
    onTierScroll: scroll.onTierScroll,
    seekFromTierClientX: scroll.seekFromTierClientX,
    centerTierAtClientX: scroll.centerTierAtClientX,
    setTierScrollPx: scroll.setTierScrollPx,
    userScrubScroll: scroll.userScrubScroll,
    applyWheelScrollDelta: scroll.applyWheelScrollDelta,
    cancelTransientScrollMotion: scroll.cancelTransientScrollMotion,
    minimapScrubScroll: scroll.minimapScrubScroll,
    tierScrollLive: scroll.tierScrollLive,
    suppressPlaybackFollowForSelectionSeek,
    getVisualPlayheadTimeSec: visualPlayheadClock.getVisualPlayheadTimeSec,
    subscribePlayheadFrame: visualPlayheadClock.subscribePlayheadFrame,
    clearWaveformPeaksCache: peaks.clearAndReloadPeaks,
    routePrefs,
    deferDecodeMount,
    mountDeferTimedOut,
    waveformPeaksPhase,
  };
}
