import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TierScrollLayoutMetrics, TierScrollLiveRefs } from "../utils/waveformViewport";
import { useProjectWaveform } from "./useProjectWaveform";
import type { useProjectWaveform as UseProjectWaveformHook } from "./useProjectWaveform";
import { useTierScrollSync } from "./useTierScrollSync";
import { useWaveformPlaybackScrollFollow } from "./useWaveformPlaybackScrollFollow";
import { useWaveformEditorRoutePrefs } from "./useWaveformEditorRoutePrefs";
import { useWaveformDisplay } from "./useWaveformDisplay";
import { useWaveformPeaks } from "./useWaveformPeaks";
import { useWaveformZoom } from "./useWaveformZoom";
import { clampPxPerSecForLayout } from "../utils/pxPerSec";
import { resolveFitAllPxPerSecAdjustment } from "../utils/waveformZoomBarState";
import { resolveWaveformTimelineMetrics } from "../utils/waveformTimelineMetrics";
import { useTranscriptionViewportFit } from "../pages/useTranscriptionViewportFit";
import { useWaveformTimelineMountGate } from "./useWaveformTimelineMountGate";
import { useWaveformTimelineDurationSync } from "./useWaveformTimelineDuration";
import { useWaveformPeaksPhaseState } from "./useWaveformPeaksPhaseState";
import { useWaveformVisualPlayheadClock } from "./useWaveformVisualPlayheadClock";
import { setWaveSurferVisualProgressRatioReader } from "../services/waveform/waveformSurferProgressCoverage";
import { WAVEFORM_BACKGROUND_PEAKS_ENABLED } from "../utils/waveformPrefs";
import { useWaveformMediaZoomResetEffect } from "./useWaveformMediaZoomResetEffect";
import { useFileViewStateRestoreEffect } from "./useFileViewStateRestoreEffect";
import {
  scheduleTierScrollFrame,
  setPlaybackFractionalPx,
} from "../utils/tierScrollFrameCoordinator";
import { clearPlaybackFollowDriving } from "../utils/waveformPlaybackSubpixel";
import { snapPlaybackViewportAfterSeek } from "../utils/snapPlaybackViewportAfterSeek";
import { SEEK_SETTLE_WINDOW_MS } from "../utils/waveformSeekSettle";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";

type WfApi = ReturnType<typeof UseProjectWaveformHook>;

/** Waveform timeline: zoom, scroll, peaks, viewport fit (ADR-0005). */
export function useWaveformTimelineController(ctx: TranscriptionLayerInput) {
  const tierScrollRef = useRef<HTMLDivElement | null>(null);
  const tierViewportMetricsRef = useRef<{
    tierScrollLive: TierScrollLiveRefs;
    tierScrollLayout: TierScrollLayoutMetrics;
  } | null>(null);
  const durationRef = useRef(0);
  const timelineWidthPxRef = useRef(0);
  const pxPerSecRef = useRef(56);
  const scrollApiRef = useRef({
    revealSelectionScroll: (_scrollLeftPx: number, _options?: { timelineWidthPx?: number }) => {},
  });
  const wfApiRef = useRef<WfApi>(null!);
  const playbackFollowSuppressUntilRef = useRef(0);
  const syncDisplayPlayheadAfterSeekRef = useRef<((timeSec: number) => void) | null>(null);
  const beginVisualSeekRef = useRef<((timeSec: number) => void) | null>(null);
  const endVisualSeekRef = useRef<((timeSec: number) => void) | null>(null);
  const snapPlaybackViewportAfterSeekRef = useRef<((timeSec: number) => void) | null>(null);
  const getDisplayPlayheadTimeSecRef = useRef<(() => number) | null>(null);
  const onWsAudioprocessRef = useRef<((timeSec: number) => void) | null>(null);
  const suppressPlaybackFollowForSelectionSeek = () => {
    // Arm follow freeze *before* async transport seek starts. Clearing here left a
    // Windows-visible race: edge follow kept scrolling on the old playhead while
    // setTime was still in flight — looked like “page scroll without seek land”.
    // beginVisualSeek / endVisualSeek still own the window through ACK + grounding.
    playbackFollowSuppressUntilRef.current = Number.POSITIVE_INFINITY;
  };
  const applyPendingViewportFitRef = useRef<(pxPerSec: number, options?: { finalize?: boolean }) => boolean>(
    () => false,
  );

  const display = useWaveformDisplay({ busy: ctx.busy });
  const routePrefs = useWaveformEditorRoutePrefs();
  const playbackScrollFollowModeRef = useRef(routePrefs.playbackScrollFollowMode);
  playbackScrollFollowModeRef.current = routePrefs.playbackScrollFollowMode;
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
    tierViewportMetricsRef,
    syncDisplayPlayheadAfterSeekRef,
    beginVisualSeekRef,
    endVisualSeekRef,
    snapPlaybackViewportAfterSeekRef,
    getDisplayPlayheadTimeSecRef,
    onWsAudioprocessRef,
    playbackFollowSuppressUntilRef,
    playbackScrollFollowModeRef,
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
    getEngineDisplayTimeSec: wf.getDisplayMediaPlayheadTimeSec,
    getRawMediaIsPlaying: wf.getRawMediaIsPlaying,
  });

  syncDisplayPlayheadAfterSeekRef.current = visualPlayheadClock.syncDisplayPlayheadAfterSeek;
  // During VisualSeeking the clock is pinned — freeze follow so edge mid-band
  // clear/sink cannot fight the seek snap (center follow is idempotent; edge is not).
  beginVisualSeekRef.current = (timeSec: number, opts?: { deferViewportFrame?: boolean }) => {
    playbackFollowSuppressUntilRef.current = Number.POSITIVE_INFINITY;
    // Kill stale follow state before the settle window: the skip-snap path (playing
    // edge listen-jump) never runs snapPlaybackViewportAfterSeek, so a leftover
    // driving flag + fractional residual would make the suppressed-frame playhead
    // fallback hard-pin at the anchor / offset the needle — a large zoom-amplified
    // jump the moment it flips to real geometry. Snap paths re-set these right after.
    clearPlaybackFollowDriving();
    setPlaybackFractionalPx(0);
    visualPlayheadClock.beginVisualSeek(timeSec, opts);
  };
  endVisualSeekRef.current = (timeSec: number) => {
    visualPlayheadClock.endVisualSeek(timeSec);
    // Grounding: keep follow frozen after seeked so scroll/frac=0 + content transform
    // repaint before mid-band sink / pageDrive resume. Shares the one
    // SEEK_SETTLE_WINDOW_MS (seeked-ACK anchor) with the native stale/settle guards
    // and visual-clock grounding so every settle window releases in the same frame.
    playbackFollowSuppressUntilRef.current = performance.now() + SEEK_SETTLE_WINDOW_MS;
  };
  getDisplayPlayheadTimeSecRef.current = visualPlayheadClock.getDisplayPlayheadTimeSec;
  onWsAudioprocessRef.current = visualPlayheadClock.onWsAudioprocess;

  useEffect(() => {
    const dur = timelineMetrics.mediaDurationSec;
    if (!wf.isPlaying || !wf.isReady || dur <= 0) {
      setWaveSurferVisualProgressRatioReader(null);
      return;
    }
    setWaveSurferVisualProgressRatioReader(
      () => visualPlayheadClock.getDisplayPlayheadTimeSec() / dur,
    );
    return () => {
      setWaveSurferVisualProgressRatioReader(null);
    };
  }, [
    timelineMetrics.mediaDurationSec,
    visualPlayheadClock.getDisplayPlayheadTimeSec,
    wf.isPlaying,
    wf.isReady,
  ]);

  const scroll = useTierScrollSync({
    tierScrollRef,
    timelineWidthPx,
    mediaDurationSec: timelineMetrics.mediaDurationSec,
    pxPerSec,
    wfApiRef,
    waveformReady: wf.isReady,
    mediaUrl: ctx.mediaUrl,
    fileId: ctx.fileId,
    playbackFollowSuppressUntilRef,
  });

  snapPlaybackViewportAfterSeekRef.current = (timeSec: number) => {
    snapPlaybackViewportAfterSeek({
      timeSec,
      followMode: routePrefs.playbackScrollFollowMode,
      timelineWidthPx: timelineWidthPxRef.current,
      durationSec: durationRef.current || timelineMetrics.mediaDurationSec,
      tierScrollEl: tierScrollRef.current,
      playbackFollowScroll: scroll.playbackFollowScroll,
    });
  };

  useLayoutEffect(() => {
    tierViewportMetricsRef.current = {
      tierScrollLive: scroll.tierScrollLive,
      tierScrollLayout: scroll.tierScrollLayout,
    };
  }, [scroll.tierScrollLayout, scroll.tierScrollLive]);

  onAfterViewportResizeRef.current = () => {
    scroll.refreshTierScrollLayout();
    wf.flushDeferredPeaksLoad();
    scheduleTierScrollFrame();
  };

  useLayoutEffect(() => {
    pxPerSecRef.current = zoom.pxPerSec;
    durationRef.current = resolvedDurationSec || timelineMetrics.mediaDurationSec || durationRef.current || 0;
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
    const layoutCap = clampPxPerSecForLayout(zoom.pxPerSec, dur);
    const layoutTol = Math.max(0.001, Math.min(layoutCap * 0.05, 8));
    if (zoom.pxPerSec > layoutCap + layoutTol) {
      // Preserve fit-selection / fit-all / default intent — not a manual slider change.
      zoom.applyFitAllRefitPxPerSec(layoutCap);
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
    getPlayheadTimeSec: visualPlayheadClock.getDisplayPlayheadTimeSec,
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
    fileId: ctx.fileId,
    mediaUrl: ctx.mediaUrl,
    mediaDurationSec: timelineMetrics.mediaDurationSec,
    segments: ctx.segments,
    layoutIntent: zoom.layoutIntent,
    currentPxPerSec: zoom.pxPerSec,
    tierScrollRef,
    tierScrollLive: scroll.tierScrollLive,
    tierScrollLayout: scroll.tierScrollLayout,
    resetZoomForMedia: (viewportWidthPx, durationSec, options) =>
      resetZoomForMediaRef.current(viewportWidthPx, durationSec, options),
  });

  useFileViewStateRestoreEffect({
    fileId: ctx.fileId,
    mediaUrl: ctx.mediaUrl,
    mediaDurationSec: timelineMetrics.mediaDurationSec,
    layoutPxPerSec: zoom.layoutPxPerSec,
    isReady: wf.isReady,
    audioReady: wf.audioReady || !ctx.mediaDiskPath,
    segments: ctx.segments,
    setPxPerSec: zoom.setPxPerSec,
    seek: (timeSec) => wf.seek(timeSec),
    selectSegmentAt: (idx) => ctx.selectSegmentAt(idx),
    suppressPlaybackFollowForSelectionSeek,
    syncDisplayPlayheadAfterSeek: visualPlayheadClock.syncDisplayPlayheadAfterSeek,
    revealSegmentInViewport: viewportFit.revealSegmentInViewport,
    tierScrollRef,
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
    dispatchTransportIntent: wf.dispatchTransportIntent,
    getDisplayPlayheadTimeSec: visualPlayheadClock.getDisplayPlayheadTimeSec,
    subscribePlayheadFrame: visualPlayheadClock.subscribePlayheadFrame,
    syncDisplayPlayheadAfterSeek: visualPlayheadClock.syncDisplayPlayheadAfterSeek,
    clearWaveformPeaksCache: peaks.clearAndReloadPeaks,
    routePrefs,
    deferDecodeMount,
    mountDeferTimedOut,
    waveformPeaksPhase,
  };
}
