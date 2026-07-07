import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatMediaTime } from "../utils/formatMediaTime";
import { exportMinimapPeaksFromWaveSurfer } from "../services/waveform/minimapPeaksSource";
import { createWaveformAppliedZoomState } from "../utils/waveformAppliedZoom";
import { requestWaveformSegmentBandPaint } from "../utils/tierScrollFrameCoordinator";
import { applyWaveSurferProgressWithoutClip } from "../services/waveform/waveformSurferProgressCoverage";
import { resolveLayoutDurationSec } from "../utils/waveformTimelineMetrics";
import { shouldCoalesceSelectionSeekChrome } from "../utils/waveformSelectionSeekChrome";
import { useWaveformHeightSync } from "./useWaveformHeightSync";
import { useWaveformPlayback } from "./useWaveformPlayback";
import { useWaveformGlobalPlayback } from "./useWaveformGlobalPlayback";
import { useWaveformSegmentPlaybackControls } from "./useWaveformSegmentPlaybackControls";
import { useWaveformZoomSync } from "./useWaveformZoomSync";
import { useWaveformViewportController } from "./useWaveformViewportController";
import {
  useProjectWaveformMount,
} from "./useProjectWaveformMount";
import { useProjectWaveformDestroy } from "./useProjectWaveformDestroy";
import { WAVEFORM_HEIGHT_DEFAULT } from "../utils/waveformPrefs";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";

export type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";

export function useProjectWaveform(options: UseProjectWaveformOptions) {
  const {
    mediaUrl,
    mediaDiskPath,
    segments,
    selectedIdx,
    disabled,
    layoutPxPerSec = 56,
    drawPxPerSec = layoutPxPerSec,
    peakCache = null,
    waveformHeightPx = WAVEFORM_HEIGHT_DEFAULT,
    onZoomApplied,
  } = options;
  const hotSwitchWhilePlaying = options.hotSwitchWhilePlaying ?? true;
  const hotSwitchWhilePlayingRef = useRef(hotSwitchWhilePlaying);
  hotSwitchWhilePlayingRef.current = hotSwitchWhilePlaying;
  const deferDecodeMount = options.deferDecodeMount ?? false;
  const optsRef = useRef(options);
  optsRef.current = options;
  const onZoomAppliedRef = useRef(onZoomApplied);
  onZoomAppliedRef.current = onZoomApplied;
  const minPxPerSecRef = useRef(layoutPxPerSec);
  minPxPerSecRef.current = layoutPxPerSec;
  const peakCacheRef = useRef(peakCache);
  peakCacheRef.current = peakCache;
  const waveformHeightRef = useRef(waveformHeightPx);
  waveformHeightRef.current = waveformHeightPx;
  const appliedWaveformHeightRef = useRef(waveformHeightPx);
  const pendingAppliedWaveformHeightRef = useRef<number | null>(waveformHeightPx);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stickyShellRef = useRef<HTMLDivElement | null>(null);
  const stretchShellRef = useRef<HTMLDivElement | null>(null);
  const timelineShellRef = useRef<HTMLDivElement | null>(null);
  const peaksStageShellRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<import("wavesurfer.js").default | null>(null);
  const wsUnsubsRef = useRef<Array<() => void>>([]);
  const lastTimeUiCommitRef = useRef(-1);
  const lastTimeUiCommitMsRef = useRef(0);
  const scrollNotifyRafRef = useRef(0);
  const pendingScrollLeftRef = useRef(0);
  const appliedZoomStateRef = useRef(createWaveformAppliedZoomState(layoutPxPerSec));
  const appliedZoom = appliedZoomStateRef.current;
  const cancelInFlightZoomRef = useRef<(() => void) | undefined>(undefined);
  const viewportResizeHoldRef = useRef(false);
  const flushDeferredPeaksLoadRef = useRef<(() => void) | undefined>(undefined);
  const fallbackLayoutDurationRef = useRef(0);
  const fallbackLayoutTimelineWidthRef = useRef(0);
  const layoutDurationSecRef = options.layoutDurationSecRef ?? fallbackLayoutDurationRef;
  const layoutTimelineWidthPxRef =
    options.layoutTimelineWidthPxRef ?? fallbackLayoutTimelineWidthRef;

  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const globalPlayback = useWaveformGlobalPlayback(wsRef, isReady);
  const applyGlobalPlaybackRateRef = useRef(globalPlayback.applyGlobalPlaybackRate);
  applyGlobalPlaybackRateRef.current = globalPlayback.applyGlobalPlaybackRate;
  const commitSeekUi = useCallback(
    (timeSec: number) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      const d = resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current });
      const clamped = d > 0 ? Math.max(0, Math.min(timeSec, d)) : Math.max(0, timeSec);
      lastTimeUiCommitRef.current = clamped;
      lastTimeUiCommitMsRef.current = performance.now();
      setCurrentTime(clamped);
      if (d > 0) {
        applyWaveSurferProgressWithoutClip(ws, clamped / d);
      }
      const suppressUntilMs = optsRef.current.selectionSeekChromeSuppressUntilRef?.current ?? 0;
      if (shouldCoalesceSelectionSeekChrome(performance.now(), suppressUntilMs)) {
        return;
      }
      requestWaveformSegmentBandPaint();
    },
    [isReady, layoutDurationSecRef],
  );
  const playback = useWaveformPlayback(
    wsRef,
    containerRef,
    isReady,
    layoutDurationSecRef,
    layoutTimelineWidthPxRef,
    applyGlobalPlaybackRateRef,
    options.tierScrollRef,
    options.tierViewportMetricsRef,
    commitSeekUi,
    options.syncDisplayPlayheadAfterSeekRef,
    options.getAuthoritativePlayheadSecRef,
  );
  const clearWsListeners = useCallback(() => {
    wsUnsubsRef.current.forEach((u) => u());
    wsUnsubsRef.current = [];
  }, []);
  const segmentPlayback = useWaveformSegmentPlaybackControls({
    wsRef,
    isReady,
    segments,
    selectedIdx,
    getGlobalPlaybackRate: () => globalPlayback.globalPlaybackRate,
    getAuthoritativePlayheadSecRef: options.getAuthoritativePlayheadSecRef,
    syncDisplayPlayheadAfterSeekRef: options.syncDisplayPlayheadAfterSeekRef,
  });

  const requestViewportChromeFrame = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      requestWaveformSegmentBandPaint();
    } catch {
      /* noop */
    }
  }, []);

  const syncTierScrollAfterRenderRef = useRef<() => void>(() => {});
  syncTierScrollAfterRenderRef.current = () => {
    requestViewportChromeFrame();
  };

  const mountRefs = useMemo(
    () => ({
      optsRef,
      containerRef,
      wsRef,
      wsUnsubsRef,
      minPxPerSecRef,
      peakCacheRef,
      layoutDurationSecRef,
      waveformHeightRef,
      appliedWaveformHeightRef,
      pendingAppliedWaveformHeightRef,
      appliedZoom,
      syncTierScrollAfterRenderRef,
      lastTimeUiCommitRef,
      lastTimeUiCommitMsRef,
      scrollNotifyRafRef,
      pendingScrollLeftRef,
      setLoadError,
      setIsReady,
      setIsPlaying,
      setDuration,
      setCurrentTime,
    }),
    [appliedZoom, layoutDurationSecRef],
  );

  const destroyWave = useProjectWaveformDestroy(clearWsListeners, mountRefs, mountRefs);

  useProjectWaveformMount(
    mediaUrl,
    mediaDiskPath,
    deferDecodeMount,
    mountRefs,
    destroyWave,
  );

  const { refitFitAllIfNeeded, syncShellLayoutForZoom } = useWaveformViewportController({
    wsRef,
    containerRef,
    stickyShellRef,
    stretchShellRef,
    tierScrollRef: options.tierScrollRef,
    isReady,
    deferDecodeMount,
    onAfterViewportResizeRef: options.onAfterViewportResizeRef,
    syncScrollAfterRender: () => {
      requestViewportChromeFrame();
    },
    refitFitAllPxPerSec: options.refitFitAllPxPerSec,
    appliedZoom,
    onFitAllPxPerSecRefit: options.onFitAllPxPerSecRefit,
    layoutDurationSecRef,
    layoutTimelineWidthPxRef,
    timelineShellRef,
    peaksStageShellRef,
    viewportResizeHoldRef,
  });

  const peakCacheGeneration = options.peakCacheGeneration ?? 0;

  const zoomSync = useWaveformZoomSync({
    wsRef,
    isReady,
    isPlaying,
    hotSwitchWhilePlayingRef,
    hotSwitchWhilePlaying,
    disabled,
    layoutPxPerSec,
    drawPxPerSec,
    appliedZoom,
    peakCache,
    peakCacheGeneration,
    peakCacheRef,
    layoutDurationSecRef,
    layoutDurationSec: options.layoutDurationSec ?? 0,
    mediaUrl,
    onZoomAppliedRef,
    cancelInFlightZoomRef,
    viewportResizeHoldRef,
    flushDeferredPeaksLoadRef,
  });

  const cancelInFlightZoom = useCallback(() => {
    cancelInFlightZoomRef.current?.();
  }, []);

  useWaveformHeightSync({
    wsRef,
    containerRef,
    waveformHeightPx,
    isReady,
    disabled,
    appliedWaveformHeightRef,
    pendingAppliedWaveformHeightRef,
  });

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    ws.toggleInteraction(!disabled);
  }, [disabled, isReady]);

  const exportMinimapPeaks = useCallback(
    (overviewWidthPx: number) => {
      if (!isReady) return null;
      return exportMinimapPeaksFromWaveSurfer(wsRef.current, overviewWidthPx);
    },
    [isReady],
  );

  const togglePlay = useCallback(async () => {
    segmentPlayback.clearSegmentPlaybackBound();
    await playback.togglePlay();
  }, [playback, segmentPlayback]);

  const seek = useCallback(
    (timeSec: number) => {
      if (segmentPlayback.isSelectedSegmentPlaying) {
        segmentPlayback.clearSegmentPlaybackBound();
      }
      playback.seek(timeSec);
    },
    [playback, segmentPlayback],
  );

  const seekByDelta = useCallback(
    (deltaSec: number) => {
      if (segmentPlayback.isSelectedSegmentPlaying) {
        segmentPlayback.clearSegmentPlaybackBound();
      }
      playback.seekByDelta(deltaSec);
    },
    [playback, segmentPlayback],
  );

  return {
    containerRef,
    stickyShellRef,
    stretchShellRef,
    timelineShellRef,
    peaksStageShellRef,
    isReady,
    loadError,
    isPlaying,
    duration,
    currentTime,
    refitFitAllIfNeeded,
    syncShellLayoutForZoom,
    flushDeferredPeaksLoad: () => flushDeferredPeaksLoadRef.current?.(),
    ...playback,
    seek,
    seekByDelta,
    ...globalPlayback,
    ...segmentPlayback,
    togglePlay,
    formatMediaTime,
    destroyWave,
    cancelInFlightZoom,
    peaksHotSwitchPending: zoomSync.peaksHotSwitchPending,
    peaksApplied: zoomSync.peaksApplied,
    exportMinimapPeaks,
  };
}
