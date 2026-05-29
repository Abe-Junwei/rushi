import { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { formatMediaTime } from "../utils/formatMediaTime";
import type { WaveformRulerView } from "../utils/waveformViewport";
import { useWaveformHeightSync } from "./useWaveformHeightSync";
import { useWaveformPlayback } from "./useWaveformPlayback";
import { useWaveformGlobalPlayback } from "./useWaveformGlobalPlayback";
import { useWaveformSegmentPlaybackControls } from "./useWaveformSegmentPlaybackControls";
import { useWaveformZoomSync } from "./useWaveformZoomSync";
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
    interactionPxPerSec,
    peakCache = null,
    waveformHeightPx = 96,
    zoomDragging = false,
    onZoomApplied,
  } = options;
  const optsRef = useRef(options);
  optsRef.current = options;
  const onZoomAppliedRef = useRef(onZoomApplied);
  onZoomAppliedRef.current = onZoomApplied;
  const getViewportScrollPxRef = useRef(options.getViewportScrollPx);
  getViewportScrollPxRef.current = options.getViewportScrollPx;
  const minPxPerSecRef = useRef(minPxPerSec);
  minPxPerSecRef.current = minPxPerSec;
  const interactionPxPerSecRef = useRef(interactionPxPerSec ?? minPxPerSec);
  interactionPxPerSecRef.current = interactionPxPerSec ?? minPxPerSec;
  const peakCacheRef = useRef(peakCache);
  peakCacheRef.current = peakCache;
  const waveformHeightRef = useRef(waveformHeightPx);
  waveformHeightRef.current = waveformHeightPx;
  const appliedWaveformHeightRef = useRef(waveformHeightPx);
  const pendingAppliedWaveformHeightRef = useRef<number | null>(waveformHeightPx);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const wsUnsubsRef = useRef<Array<() => void>>([]);
  const lastTimeUiCommitRef = useRef(-1);
  const lastTimeUiCommitMsRef = useRef(0);
  const scrollNotifyRafRef = useRef(0);
  const pendingScrollLeftRef = useRef(0);
  const appliedZoomPxPerSecRef = useRef(minPxPerSec);
  const appliedPeaksRef = useRef(false);
  const cancelInFlightZoomRef = useRef<(() => void) | undefined>(undefined);

  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [rulerView, setRulerView] = useState<WaveformRulerView | null>(null);
  const globalPlayback = useWaveformGlobalPlayback(wsRef, isReady);
  const applyGlobalPlaybackRateRef = useRef(globalPlayback.applyGlobalPlaybackRate);
  applyGlobalPlaybackRateRef.current = globalPlayback.applyGlobalPlaybackRate;
  const playback = useWaveformPlayback(
    wsRef,
    containerRef,
    isReady,
    minPxPerSecRef,
    interactionPxPerSecRef,
    applyGlobalPlaybackRateRef,
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

  const mountRefs = {
    optsRef,
    containerRef,
    wsRef,
    wsUnsubsRef,
    minPxPerSecRef,
    peakCacheRef,
    waveformHeightRef,
    appliedWaveformHeightRef,
    pendingAppliedWaveformHeightRef,
    appliedZoomPxPerSecRef,
    appliedPeaksRef,
    lastTimeUiCommitRef,
    lastTimeUiCommitMsRef,
    scrollNotifyRafRef,
    pendingScrollLeftRef,
    setLoadError,
    setIsReady,
    setIsPlaying,
    setDuration,
    setCurrentTime,
    setRulerView,
  };

  const destroyWave = useProjectWaveformDestroy(clearWsListeners, mountRefs, mountRefs);

  useProjectWaveformMount(mediaUrl, mountRefs, destroyWave);

  useWaveformZoomSync({
    wsRef,
    isReady,
    disabled,
    minPxPerSec,
    appliedZoomPxPerSecRef,
    appliedPeaksRef,
    peakCache,
    peakCacheRef,
    mediaUrl,
    zoomDragging,
    getViewportScrollPxRef,
    onZoomAppliedRef,
    cancelInFlightZoomRef,
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
    appliedPeaksRef,
  });

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    ws.toggleInteraction(!disabled);
  }, [disabled, isReady]);

  return {
    containerRef,
    isReady,
    loadError,
    isPlaying,
    duration,
    currentTime,
    rulerView,
    ...playback,
    ...globalPlayback,
    ...segmentPlayback,
    formatMediaTime,
    destroyWave,
    cancelInFlightZoom,
  };
}
