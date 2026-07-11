import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatMediaTime } from "../utils/formatMediaTime";
import { exportMinimapPeaksFromWaveSurfer } from "../services/waveform/minimapPeaksSource";
import { createWaveformAppliedZoomState } from "../utils/waveformAppliedZoom";
import { requestWaveformSegmentBandPaint } from "../utils/tierScrollFrameCoordinator";
import { applyWaveSurferProgressWithoutClip, syncWaveSurferScrollFromTier as applyWaveSurferTierScroll } from "../services/waveform/waveformSurferProgressCoverage";
import { resolveLayoutDurationSec } from "../utils/waveformTimelineMetrics";
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
import {
  dispatchTransportIntent,
  type TransportIntent,
} from "../services/waveform/transport";
import { effectiveTranscriptPrimaryIdx } from "../components/editor/core/projectionWaveformBridge";
import { reconcileSegmentsRefWithState } from "../pages/segmentSegmentsRefSync";

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
    options.getDisplayPlayheadTimeSecRef,
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
    getPlayheadTime: playback.getPlayheadTime,
    getRawMediaPlayheadTimeSec: playback.getRawMediaPlayheadTimeSec,
    syncDisplayPlayheadAfterSeekRef: options.syncDisplayPlayheadAfterSeekRef,
    layoutDurationSecRef,
    commitSeekUi,
  });

  // Read-only prop mirror for transport callbacks — not a structure mutation.
  const segmentsRef = useRef(segments);
  reconcileSegmentsRefWithState(segmentsRef, segments);
  const selectedIdxForTransportRef = useRef(selectedIdx);
  selectedIdxForTransportRef.current = selectedIdx;

  const suppressPlaybackFollow = useCallback(() => {
    const untilRef = optsRef.current.playbackFollowSuppressUntilRef;
    if (untilRef) untilRef.current = performance.now() + 1200;
  }, []);

  const dispatchTransport = useCallback(
    async (intent: TransportIntent) => {
      const ws = wsRef.current;
      await dispatchTransportIntent(intent, {
        isReady,
        getDurationSec: () =>
          resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current }),
        syncDisplayPlayheadAfterSeek: (t) =>
          optsRef.current.syncDisplayPlayheadAfterSeekRef?.current?.(t),
        commitSeekUi,
        suppressPlaybackFollow,
        media: {
          setTime: (t) => ws?.setTime(t),
          play: () => ws?.play(),
          pause: () => ws?.pause(),
          isPlaying: () => ws?.isPlaying() ?? false,
        },
        applySeek: (timeSec, seekOpts) => {
          segmentPlayback.clearPausedResumeAnchor();
          if (seekOpts?.suppressFollow) suppressPlaybackFollow();
          if (segmentPlayback.isSelectedSegmentPlaying) {
            segmentPlayback.clearSegmentPlaybackBound();
          }
          playback.seek(timeSec);
        },
        runPlaySegment: (playArgs) => segmentPlayback.runPlaySegmentResolved(playArgs),
        runToggleSegmentPlay: () => segmentPlayback.toggleSelectedWaveformPlayImpl(),
        resolvePlayFromInput: (idx, fromSec) => {
          const seg = segmentsRef.current[idx];
          if (!seg) return null;
          return {
            segment: seg,
            fromSec,
            displaySec: playback.getPlayheadTime(),
            rawMediaSec: playback.getRawMediaPlayheadTimeSec(),
          };
        },
      });
    },
    [commitSeekUi, isReady, layoutDurationSecRef, playback, segmentPlayback, suppressPlaybackFollow],
  );

  const requestViewportChromeFrame = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      requestWaveformSegmentBandPaint();
    } catch {
      /* noop */
    }
  }, []);

  const getTierScrollLeftPxRef = useRef<() => number>(() => 0);
  getTierScrollLeftPxRef.current = () => {
    const tier = options.tierScrollRef?.current;
    if (tier) return tier.scrollLeft;
    const live = options.tierViewportMetricsRef?.current?.tierScrollLive.scrollLeftRef.current;
    if (typeof live === "number" && Number.isFinite(live)) return live;
    return 0;
  };

  const syncTierScrollAfterRenderRef = useRef<() => void>(() => {});
  syncTierScrollAfterRenderRef.current = () => {
    const ws = wsRef.current;
    if (ws) applyWaveSurferTierScroll(ws, getTierScrollLeftPxRef.current());
    requestViewportChromeFrame();
  };

  const syncWaveSurferScrollFromTier = useCallback((scrollLeftPx: number) => {
    const ws = wsRef.current;
    if (!ws) return;
    applyWaveSurferTierScroll(ws, scrollLeftPx);
  }, []);

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
      getTierScrollLeftPxRef,
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
    // WS-2b: do not re-inflate WS scrollW via ws.zoom / ws.load(peaks).
    disabled: true,
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
      void dispatchTransport({ kind: "seek", timeSec, source: "segmentSelect" });
    },
    [dispatchTransport],
  );

  const seekByDelta = useCallback(
    (deltaSec: number) => {
      const base = playback.getPlayheadTime();
      void dispatchTransport({
        kind: "seek",
        timeSec: base + deltaSec,
        source: "keyboardFrame",
      });
    },
    [dispatchTransport, playback],
  );

  const playSegmentAtIndex = useCallback(
    async (idx: number, playOpts?: { loop?: boolean; fromSec?: number }) => {
      await dispatchTransport({
        kind: "playSegment",
        idx,
        fromSec: playOpts?.fromSec,
        loop: playOpts?.loop,
      });
    },
    [dispatchTransport],
  );

  const handleToggleSelectedWaveformPlay = useCallback(async () => {
    const idx = effectiveTranscriptPrimaryIdx(selectedIdxForTransportRef.current);
    if (idx < 0 || !segmentsRef.current[idx]) return;
    await dispatchTransport({ kind: "toggleSegmentPlay" });
  }, [dispatchTransport]);

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
    segmentLoopPlayback: segmentPlayback.segmentLoopPlayback,
    isSelectedSegmentPlaying: segmentPlayback.isSelectedSegmentPlaying,
    preserveLoopForNextSegmentSelect: segmentPlayback.preserveLoopForNextSegmentSelect,
    clearSegmentPlaybackBound: segmentPlayback.clearSegmentPlaybackBound,
    handleToggleSelectedWaveformLoop: segmentPlayback.handleToggleSelectedWaveformLoop,
    playSegmentAtIndex,
    handleToggleSelectedWaveformPlay,
    dispatchTransportIntent: dispatchTransport,
    togglePlay,
    formatMediaTime,
    destroyWave,
    cancelInFlightZoom,
    peaksHotSwitchPending: zoomSync.peaksHotSwitchPending,
    peaksApplied: zoomSync.peaksApplied,
    exportMinimapPeaks,
    syncWaveSurferScrollFromTier,
  };
}
