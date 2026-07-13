import { useCallback, useRef, useState } from "react";
import { createWaveformAppliedZoomState } from "../utils/waveformAppliedZoom";
import { requestWaveformSegmentBandPaint } from "../utils/tierScrollFrameCoordinator";
import { applyWaveSurferProgressWithoutClip } from "../services/waveform/waveformSurferProgressCoverage";
import { resolveLayoutDurationSec } from "../utils/waveformTimelineMetrics";
import { WAVEFORM_HEIGHT_DEFAULT } from "../utils/waveformPrefs";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";
import type { PlaybackTransport } from "../services/waveform/transport";
import type { PeakCache } from "../services/waveform/PeakCache";

/** Shell refs, ready/play state, and seek UI commit for project waveform. */
export function useProjectWaveformShellState(options: UseProjectWaveformOptions) {
  const {
    layoutPxPerSec = 56,
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
  const peakCacheRef = useRef<PeakCache | null>(peakCache);
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
  const transportRef = useRef<PlaybackTransport | null>(null);
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
  const [audioReady, setAudioReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [transportEpoch, setTransportEpoch] = useState(0);
  const bumpTransportEpoch = useCallback(() => {
    setTransportEpoch((n) => n + 1);
  }, []);

  const clearWsListeners = useCallback(() => {
    wsUnsubsRef.current.forEach((u) => u());
    wsUnsubsRef.current = [];
  }, []);

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
      requestWaveformSegmentBandPaint();
    },
    [isReady, layoutDurationSecRef],
  );

  const cancelInFlightZoom = useCallback(() => {
    cancelInFlightZoomRef.current?.();
  }, []);

  return {
    hotSwitchWhilePlaying,
    hotSwitchWhilePlayingRef,
    deferDecodeMount,
    optsRef,
    onZoomAppliedRef,
    minPxPerSecRef,
    peakCacheRef,
    waveformHeightRef,
    appliedWaveformHeightRef,
    pendingAppliedWaveformHeightRef,
    containerRef,
    stickyShellRef,
    stretchShellRef,
    timelineShellRef,
    peaksStageShellRef,
    wsRef,
    transportRef,
    wsUnsubsRef,
    lastTimeUiCommitRef,
    lastTimeUiCommitMsRef,
    scrollNotifyRafRef,
    pendingScrollLeftRef,
    appliedZoom,
    cancelInFlightZoomRef,
    viewportResizeHoldRef,
    flushDeferredPeaksLoadRef,
    layoutDurationSecRef,
    layoutTimelineWidthPxRef,
    isReady,
    setIsReady,
    audioReady,
    setAudioReady,
    loadError,
    setLoadError,
    isPlaying,
    setIsPlaying,
    duration,
    setDuration,
    currentTime,
    setCurrentTime,
    transportEpoch,
    bumpTransportEpoch,
    clearWsListeners,
    commitSeekUi,
    cancelInFlightZoom,
  };
}
