import { useCallback, useEffect, useRef, useState } from "react";
import { formatMediaTime } from "../utils/formatMediaTime";
import { useWaveformHeightSync } from "./useWaveformHeightSync";
import { useWaveformPlayback } from "./useWaveformPlayback";
import { useWaveformGlobalPlayback } from "./useWaveformGlobalPlayback";
import { useWaveformSegmentPlaybackControls } from "./useWaveformSegmentPlaybackControls";
import { useWaveformZoomSync } from "./useWaveformZoomSync";
import { useWaveformViewportController } from "./useWaveformViewportController";
import {
  useProjectWaveformDestroy,
  useProjectWaveformMount,
} from "./useProjectWaveformMount";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";

export type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";

export function useProjectWaveform(options: UseProjectWaveformOptions) {
  const {
    mediaUrl,
    segments,
    selectedIdx,
    disabled,
    minPxPerSec = 56,
    peakCache = null,
    waveformHeightPx = 96,
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
  const getViewportScrollPxRef = useRef(options.getViewportScrollPx);
  getViewportScrollPxRef.current = options.getViewportScrollPx;
  const minPxPerSecRef = useRef(minPxPerSec);
  minPxPerSecRef.current = minPxPerSec;
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
  const appliedZoomPxPerSecRef = useRef(minPxPerSec);
  const appliedPeaksRef = useRef(false);
  const appliedPeaksLoadPxPerSecRef = useRef(Number.NaN);
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
  const playback = useWaveformPlayback(
    wsRef,
    containerRef,
    isReady,
    layoutDurationSecRef,
    layoutTimelineWidthPxRef,
    applyGlobalPlaybackRateRef,
    options.tierScrollRef,
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
  });

  const syncWaveSurferScrollPx = useCallback((scrollLeftPx: number) => {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      ws.setScroll(scrollLeftPx);
    } catch {
      /* noop */
    }
  }, []);

  const syncTierScrollAfterRenderRef = useRef<() => void>(() => {});
  syncTierScrollAfterRenderRef.current = () => {
    syncWaveSurferScrollPx(getViewportScrollPxRef.current?.() ?? 0);
  };

  const mountRefs = {
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
    appliedZoomPxPerSecRef,
    appliedPeaksRef,
    appliedPeaksLoadPxPerSecRef,
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
  };

  const destroyWave = useProjectWaveformDestroy(clearWsListeners, mountRefs, mountRefs);

  useProjectWaveformMount(mediaUrl, deferDecodeMount, mountRefs, destroyWave);

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
      syncWaveSurferScrollPx(getViewportScrollPxRef.current?.() ?? 0);
    },
    refitFitAllPxPerSec: options.refitFitAllPxPerSec,
    appliedZoomPxPerSecRef,
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
    minPxPerSec,
    appliedZoomPxPerSecRef,
    appliedPeaksRef,
    appliedPeaksLoadPxPerSecRef,
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
    syncWaveSurferScrollPx,
    refitFitAllIfNeeded,
    syncShellLayoutForZoom,
    flushDeferredPeaksLoad: () => flushDeferredPeaksLoadRef.current?.(),
    ...playback,
    ...globalPlayback,
    ...segmentPlayback,
    formatMediaTime,
    destroyWave,
    cancelInFlightZoom,
    peaksHotSwitchPending: zoomSync.peaksHotSwitchPending,
    peaksApplied: zoomSync.peaksApplied,
  };
}
