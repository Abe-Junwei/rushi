import { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { formatMediaTime } from "../utils/formatMediaTime";
import { waveformBoundsSignature } from "../utils/boundsSignature";
import { segmentsUidSignature } from "../utils/segmentUid";
import type { WaveformRulerView } from "../utils/waveformViewport";
import { useWaveformHeightSync } from "./useWaveformHeightSync";
import { useWaveformPlayback } from "./useWaveformPlayback";
import { useWaveformRegions } from "./useWaveformRegions";
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
    peakCache = null,
    waveformHeightPx = 96,
    zoomDragging = false,
    onWaveformCreateRange,
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
  const peakCacheRef = useRef(peakCache);
  peakCacheRef.current = peakCache;
  const waveformHeightRef = useRef(waveformHeightPx);
  waveformHeightRef.current = waveformHeightPx;
  const appliedWaveformHeightRef = useRef(waveformHeightPx);
  const pendingAppliedWaveformHeightRef = useRef<number | null>(waveformHeightPx);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);
  const wsUnsubsRef = useRef<Array<() => void>>([]);
  const lastTimeUiCommitRef = useRef(-1);
  const lastTimeUiCommitMsRef = useRef(0);
  const scrollNotifyRafRef = useRef(0);
  const pendingScrollLeftRef = useRef(0);
  const appliedZoomPxPerSecRef = useRef(minPxPerSec);
  const appliedPeaksRef = useRef(false);

  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [rulerView, setRulerView] = useState<WaveformRulerView | null>(null);
  const playback = useWaveformPlayback(
    wsRef,
    containerRef,
    isReady,
    minPxPerSecRef,
    minPxPerSecRef,
    options.getViewportScrollPx,
  );
  const boundsSig = waveformBoundsSignature(segments);
  const uidSig = segmentsUidSignature(segments);
  const clearWsListeners = useCallback(() => {
    wsUnsubsRef.current.forEach((u) => u());
    wsUnsubsRef.current = [];
  }, []);
  const { clearRegionListeners } = useWaveformRegions(
    wsRef,
    regionsRef,
    optsRef,
    isReady,
    disabled,
    boundsSig,
    uidSig,
    selectedIdx,
    onWaveformCreateRange,
  );
  const segmentPlayback = useWaveformSegmentPlaybackControls({
    wsRef,
    regionsRef,
    isReady,
    segments,
    selectedIdx,
  });

  const mountRefs = {
    optsRef,
    containerRef,
    wsRef,
    regionsRef,
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

  const destroyWave = useProjectWaveformDestroy(
    clearRegionListeners,
    clearWsListeners,
    mountRefs,
    mountRefs,
  );

  useProjectWaveformMount(mediaUrl, mountRefs, destroyWave);

  useEffect(() => {
    const ws = wsRef.current;
    const cache = peakCache;
    if (!ws || !isReady || !cache || !mediaUrl || appliedPeaksRef.current) return;
    try {
      const bundle = cache.getWaveSurferPeaks(minPxPerSecRef.current);
      appliedPeaksRef.current = true;
      void ws.load(mediaUrl, bundle.peaks, bundle.duration);
    } catch {
      /* peaks 损坏时保留 WS decode 回退 */
    }
  }, [peakCache, isReady, mediaUrl]);

  useWaveformZoomSync({
    wsRef,
    isReady,
    disabled,
    minPxPerSec,
    appliedZoomPxPerSecRef,
    peakCacheRef,
    mediaUrl,
    zoomDragging,
    getViewportScrollPxRef,
    onZoomAppliedRef,
  });

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
    isReady,
    loadError,
    isPlaying,
    duration,
    currentTime,
    rulerView,
    ...playback,
    ...segmentPlayback,
    formatMediaTime,
    destroyWave,
  };
}
