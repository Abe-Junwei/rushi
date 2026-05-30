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
import { resolveTierViewportMetrics } from "../utils/waveformViewport";
import { useTranscriptionViewportFit } from "../pages/useTranscriptionViewportFit";
import { useWaveformTimelineMountGate } from "./useWaveformTimelineMountGate";
import { useWaveformTimelineDurationSync } from "./useWaveformTimelineDuration";
import { useWaveformPeaksPhaseState } from "./useWaveformPeaksPhaseState";
import { writeStoredWaveformPxPerSecForMedia } from "../utils/waveformPrefs";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";

type WfApi = ReturnType<typeof UseProjectWaveformHook>;

/** Waveform timeline: zoom, scroll, peaks, viewport fit (ADR-0005). */
export function useWaveformTimelineController(ctx: TranscriptionLayerInput) {
  const tierScrollRef = useRef<HTMLDivElement | null>(null);
  const durationRef = useRef(0);
  const timelineWidthPxRef = useRef(0);
  const pxPerSecRef = useRef(56);
  const scrollApiRef = useRef({ setTierScrollPx: (_scrollLeftPx: number) => {} });
  const wfApiRef = useRef<WfApi>(null!);
  const playbackFollowSuppressUntilRef = useRef(0);
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
    routePrefs.backgroundPeaksEnabled,
    ctx.mediaUrl,
  );

  const getViewportScrollPxRef = useRef<() => number>(() => 0);
  getViewportScrollPxRef.current = () => tierScrollRef.current?.scrollLeft ?? 0;

  const mountMediaDurationSec = resolvedDurationSec || peaks.status?.durationSec || 0;

  const refitFitAllPxPerSecRef = useRef<(viewportWidthPx: number) => number | null>(() => null);
  const onAfterViewportResizeRef = useRef<(() => void) | undefined>(undefined);

  const { deferDecodeMount, mountDeferTimedOut } = useWaveformTimelineMountGate({
    mediaUrl: ctx.mediaUrl,
    mediaDurationSec: mountMediaDurationSec,
    backgroundPeaksEnabled: routePrefs.backgroundPeaksEnabled,
    peaksLoading: peaks.loading,
    peakCache: peaks.peakCache,
    peaksUnavailable: peaks.peaksUnavailable,
  });

  const wf = useProjectWaveform({
    mediaUrl: ctx.mediaUrl,
    segments: ctx.segments,
    selectedIdx: ctx.selectedIdx,
    disabled: ctx.busy,
    minPxPerSec: zoom.layoutPxPerSec,
    drawPxPerSec: zoom.drawPxPerSec,
    peakCache: peaks.peakCache,
    peakCacheGeneration: peaks.peakCacheGeneration,
    deferDecodeMount,
    onAfterViewportResizeRef,
    getViewportScrollPx: () => getViewportScrollPxRef.current(),
    waveformHeightPx: display.waveformRenderHeightPx,
    onWaveformHeightApplied: display.markWaveformRenderHeightApplied,
    onWaveformCreateRange: ctx.insertSegmentFromTimeRange,
    hotSwitchWhilePlaying: routePrefs.hotSwitchWhilePlaying,
    layoutDurationSecRef: durationRef,
    layoutTimelineWidthPxRef: timelineWidthPxRef,
    layoutDurationSec: resolvedDurationSec || mountMediaDurationSec,
    tierScrollRef,
    refitFitAllPxPerSec: (viewportWidthPx) => refitFitAllPxPerSecRef.current(viewportWidthPx),
    onFitAllPxPerSecRefit: zoom.applyFitAllRefitPxPerSec,
    onZoomApplied: (pxPerSec) =>
      applyPendingViewportFitRef.current(pxPerSec, { finalize: true }),
  });

  wfApiRef.current = wf;

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
        peaksStatusDurationSec:
          wf.isReady || peaks.peakCache ? (peaks.status?.durationSec ?? 0) : 0,
        pxPerSec: zoom.pxPerSec,
      }),
    [zoom.pxPerSec, peaks.status?.durationSec, peaks.peakCache, wf.duration, wf.isReady],
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
  };

  useLayoutEffect(() => {
    pxPerSecRef.current = zoom.pxPerSec;
    durationRef.current = resolvedDurationSec || timelineMetrics.mediaDurationSec || 0;
    timelineWidthPxRef.current = timelineWidthPx;
  }, [zoom.pxPerSec, resolvedDurationSec, timelineMetrics.mediaDurationSec, timelineWidthPx]);

  useLayoutEffect(() => {
    if (timelineWidthPx <= 0) return;
    wf.syncShellLayoutForZoom();
  }, [timelineWidthPx, wf]);

  useLayoutEffect(() => {
    if (timelineMetrics.mediaDurationSec <= 0) return;
    wf.refitFitAllIfNeeded();
    const dur = timelineMetrics.mediaDurationSec;
    const renderCap = clampPxPerSecForWaveSurferRender(zoom.pxPerSec, dur);
    const renderTol = Math.max(0.001, Math.min(renderCap * 0.05, 8));
    if (zoom.pxPerSec > renderCap + renderTol) {
      // Preserve fit-selection / fit-all / default intent — not a manual slider change.
      zoom.applyFitAllRefitPxPerSec(renderCap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    timelineMetrics.mediaDurationSec,
    scroll.tierScrollLayout.clientWidthPx,
    zoom.layoutIntent,
    zoom.pxPerSec,
    peaks.peakCache,
    wf.duration,
    wf.isReady,
  ]);

  useWaveformPlaybackScrollFollow({
    tierScrollRef,
    timelineWidthPx,
    durationSec: timelineMetrics.mediaDurationSec,
    isPlaying: wf.isPlaying,
    isReady: wf.isReady,
    enabled: Boolean(ctx.mediaUrl && wf.isReady),
    getPlayheadTimeSec: wf.getPlayheadTime,
    setTierScrollPx: scroll.setTierScrollPx,
    userScrollSuppressUntilRef: playbackFollowSuppressUntilRef,
  });

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
    backgroundPeaksEnabled: routePrefs.backgroundPeaksEnabled,
    mountDeferred: deferDecodeMount,
  });

  const prevMediaUrlRef = useRef<string | null>(null);
  const pendingMediaZoomResetRef = useRef(false);

  useEffect(() => {
    if (!ctx.mediaUrl) {
      prevMediaUrlRef.current = null;
      pendingMediaZoomResetRef.current = false;
      return;
    }
    if (prevMediaUrlRef.current !== null && prevMediaUrlRef.current !== ctx.mediaUrl) {
      pendingMediaZoomResetRef.current = true;
    }
    prevMediaUrlRef.current = ctx.mediaUrl;
  }, [ctx.mediaUrl]);

  useEffect(() => {
    if (!pendingMediaZoomResetRef.current || !ctx.mediaUrl) return;
    const dur = timelineMetrics.mediaDurationSec;
    const { viewportWidthPx: vw } = resolveTierViewportMetrics({
      tierScrollEl: tierScrollRef.current,
      tierScrollLive: scroll.tierScrollLive,
      tierScrollLayout: scroll.tierScrollLayout,
    });
    if (dur < 0.5 || vw <= 0) return;
    pendingMediaZoomResetRef.current = false;
    zoom.resetZoomForMedia(vw, dur);
    writeStoredWaveformPxPerSecForMedia(vw, dur);
  }, [ctx.mediaUrl, timelineMetrics.mediaDurationSec, scroll.tierScrollLayout.clientWidthPx, scroll.tierScrollLive.clientWidthRef, zoom]);

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
    setTierScrollPx: scroll.setTierScrollPx,
    tierScrollLive: scroll.tierScrollLive,
    clearWaveformPeaksCache: peaks.clearAndReloadPeaks,
    routePrefs,
    deferDecodeMount,
    mountDeferTimedOut,
    waveformPeaksPhase,
  };
}
