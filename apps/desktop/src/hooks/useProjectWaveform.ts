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
import {
  WAVEFORM_HEIGHT_DEFAULT,
} from "../utils/waveformPrefs";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";
import {
  applyPeaksOrderedSeek,
  dispatchTransportIntent,
  resolveMediaPlaybackHost,
  type PlaybackTransport,
  type TransportIntent,
} from "../services/waveform/transport";
import { effectiveTranscriptPrimaryIdx } from "../components/editor/core/projectionWaveformBridge";
import {
  resolveGlobalTogglePlay,
  resolveSessionTogglePlay,
} from "../utils/playbackSessionToggle";
import { resolveStickySegmentSpaceFromSec } from "../utils/segmentResumeFromSec";
import { resolveWaveformPlayheadChromeMode } from "../utils/waveformPlayheadChrome";
import { reconcileSegmentsRefWithState } from "../pages/segmentSegmentsRefSync";
import { noteMediaPaused, runGatedMediaPlay } from "../utils/mediaPlayGate";
import { isTauriRuntime } from "../config/env";
import { useNativePlaybackController } from "./useNativePlaybackController";

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
  // Desktop Tauri: native transport is mandatory (ADR-0008 maturity).
  const useNativeTransport = isTauriRuntime() && Boolean(mediaDiskPath);
  /** Single host resolver for Space / global / segment entry points. */
  const resolveHost = useCallback(
    () =>
      resolveMediaPlaybackHost(wsRef.current, transportRef.current, {
        requireTransport: useNativeTransport,
      }),
    [useNativeTransport],
  );
  const globalPlayback = useWaveformGlobalPlayback(
    wsRef,
    isReady,
    transportRef,
    useNativeTransport,
  );
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
    transportRef,
    useNativeTransport,
  );
  const clearWsListeners = useCallback(() => {
    wsUnsubsRef.current.forEach((u) => u());
    wsUnsubsRef.current = [];
  }, []);
  const segmentPlayback = useWaveformSegmentPlaybackControls({
    wsRef,
    transportRef,
    transportEpoch,
    requireTransport: useNativeTransport,
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
      const host = resolveHost();
      const media = host
        ? {
            setTime: (t: number) => {
              void Promise.resolve(host.setTime(t));
            },
            play: () => {
              const gateOpts = host.isNative ? { pauseToPlayGapMs: 0 } : undefined;
              return runGatedMediaPlay(host.gateHost, () => host.play(), gateOpts).then(
                () => undefined,
              );
            },
            pause: () => {
              void Promise.resolve(host.pause()).finally(() => {
                noteMediaPaused(host.gateHost);
              });
            },
            isPlaying: () => host.isPlaying(),
          }
        : {
            setTime: () => undefined,
            play: () => Promise.resolve(),
            pause: () => undefined,
            isPlaying: () => false,
          };
      await dispatchTransportIntent(intent, {
        isReady,
        getDurationSec: () =>
          resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current }),
        syncDisplayPlayheadAfterSeek: (t) =>
          optsRef.current.syncDisplayPlayheadAfterSeekRef?.current?.(t),
        commitSeekUi,
        suppressPlaybackFollow,
        media,
        applySeek: async (timeSec, seekOpts) => {
          segmentPlayback.clearPausedResumeAnchor();
          if (seekOpts?.suppressFollow) suppressPlaybackFollow();
          if (segmentPlayback.isSelectedSegmentPlaying) {
            segmentPlayback.clearSegmentPlaybackBound();
          }
          const d = resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current });
          await applyPeaksOrderedSeek({
            timeSec,
            durationSec: d,
            syncDisplayPlayheadAfterSeek: (t) =>
              optsRef.current.syncDisplayPlayheadAfterSeekRef?.current?.(t),
            setTime: (t) => {
              const live = resolveHost();
              return live?.setTime(t);
            },
            commitSeekUi,
          });
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
        resolveSegmentResumeFromSec: (idx, fromSec) =>
          segmentPlayback.consumeSegmentResumeFromSec(idx, fromSec),
      });
    },
    [commitSeekUi, isReady, layoutDurationSecRef, playback, resolveHost, segmentPlayback, suppressPlaybackFollow],
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

  const destroyWave = useProjectWaveformDestroy(
    clearWsListeners,
    mountRefs,
    mountRefs,
  );

  useProjectWaveformMount(
    mediaUrl,
    mediaDiskPath,
    deferDecodeMount,
    useNativeTransport,
    mountRefs,
    destroyWave,
  );

  useNativePlaybackController({
    enabled: useNativeTransport,
    mediaDiskPath,
    layoutDurationSecRef,
    peakCacheRef,
    transportRef,
    applyGlobalPlaybackRate: globalPlayback.applyGlobalPlaybackRate,
    onWsAudioprocessRef: options.onWsAudioprocessRef,
    lastTimeUiCommitRef,
    setIsPlaying,
    setCurrentTime,
    setLoadError,
    setAudioReady,
    onTransportEpoch: bumpTransportEpoch,
  });

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

  // Blank-seek Space lock must not leak across media loads.
  useEffect(() => {
    segmentPlayback.clearBlankGlobalSpaceArm();
  }, [mediaUrl, segmentPlayback.clearBlankGlobalSpaceArm]);

  const exportMinimapPeaks = useCallback(
    (overviewWidthPx: number) => {
      if (!isReady) return null;
      return exportMinimapPeaksFromWaveSurfer(wsRef.current, overviewWidthPx);
    },
    [isReady],
  );

  const seek = useCallback(
    (timeSec: number) => {
      void dispatchTransport({ kind: "seek", timeSec, source: "segmentSelect" });
    },
    [dispatchTransport],
  );

  const seekBlankToTime = useCallback(
    (timeSec: number) => {
      segmentPlayback.beginGlobalPlayback();
      segmentPlayback.armBlankGlobalSpace();
      void dispatchTransport({
        kind: "seek",
        timeSec,
        source: "blankTap",
        suppressFollow: true,
      });
    },
    [dispatchTransport, segmentPlayback],
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

  const sessionToggleInFlightRef = useRef(false);
  const togglePlay = useCallback(async () => {
    if (sessionToggleInFlightRef.current) return;
    sessionToggleInFlightRef.current = true;
    try {
      const host = resolveHost();
      const selectedSegmentIdx = effectiveTranscriptPrimaryIdx(
        selectedIdxForTransportRef.current,
      );
      const decision = resolveSessionTogglePlay({
        isPlaying: Boolean(host?.isPlaying()),
        session: segmentPlayback.getPlaybackSession(),
        segmentStillExists: (() => {
          const session = segmentPlayback.getPlaybackSession();
          return session?.kind === "segment"
            ? Boolean(segmentsRef.current[session.idx])
            : undefined;
        })(),
        selectedSegmentIdx:
          selectedSegmentIdx >= 0 && segmentsRef.current[selectedSegmentIdx]
            ? selectedSegmentIdx
            : undefined,
        preferGlobalSpace: segmentPlayback.isBlankGlobalSpaceArmed(),
      });
      if (decision.action === "pauseKeepingSession") {
        segmentPlayback.pauseMediaKeepingSession();
        return;
      }
      if (decision.action === "resumeSegment") {
        const seg = segmentsRef.current[decision.idx];
        if (!seg) {
          segmentPlayback.beginGlobalPlayback();
          await playback.togglePlay();
          return;
        }
        // Natural end freezes playhead at endSec. autoStopped can be cleared by an
        // intervening seek/sync; still force restart from segment start for Space.
        const stickyFromSec = resolveStickySegmentSpaceFromSec({
          segment: seg,
          displaySec: playback.getPlayheadTime(),
          rawMediaSec: playback.getRawMediaPlayheadTimeSec(),
        });
        await playSegmentAtIndex(
          decision.idx,
          stickyFromSec != null ? { fromSec: stickyFromSec } : undefined,
        );
        return;
      }
      segmentPlayback.beginGlobalPlayback();
      await playback.togglePlay();
    } finally {
      sessionToggleInFlightRef.current = false;
    }
  }, [playSegmentAtIndex, playback, resolveHost, segmentPlayback]);

  /** Toolbar「全局播放」: always global; exit hatch from segment play without Space sticky. */
  const toggleGlobalPlay = useCallback(async () => {
    if (sessionToggleInFlightRef.current) return;
    sessionToggleInFlightRef.current = true;
    try {
      const host = resolveHost();
      const decision = resolveGlobalTogglePlay({
        isPlaying: Boolean(host?.isPlaying()),
        session: segmentPlayback.getPlaybackSession(),
      });
      if (decision.action === "exitSegmentToGlobal") {
        segmentPlayback.beginGlobalPlayback();
        return;
      }
      if (decision.action === "pauseKeepingSession") {
        segmentPlayback.pauseMediaKeepingSession();
        return;
      }
      segmentPlayback.beginGlobalPlayback();
      await playback.togglePlay();
    } finally {
      sessionToggleInFlightRef.current = false;
    }
  }, [playback, resolveHost, segmentPlayback]);

  const handleToggleSelectedWaveformPlay = useCallback(async () => {
    const idx = effectiveTranscriptPrimaryIdx(selectedIdxForTransportRef.current);
    if (idx < 0 || !segmentsRef.current[idx]) return;
    await dispatchTransport({ kind: "toggleSegmentPlay" });
  }, [dispatchTransport]);

  const playheadChromeMode = useMemo(
    () =>
      resolveWaveformPlayheadChromeMode({
        session: segmentPlayback.getPlaybackSession(),
        isPlaying,
        isSelectedSegmentPlaying: segmentPlayback.isSelectedSegmentPlaying,
        preferGlobalSpace: segmentPlayback.isBlankGlobalSpaceArmed(),
      }),
    [
      isPlaying,
      segmentPlayback.getPlaybackSession,
      segmentPlayback.isBlankGlobalSpaceArmed,
      segmentPlayback.isSelectedSegmentPlaying,
      segmentPlayback.playbackChromeEpoch,
    ],
  );

  return {
    containerRef,
    stickyShellRef,
    stretchShellRef,
    timelineShellRef,
    peaksStageShellRef,
    isReady,
    /** Native engine Ready + transport assigned (distinct from WaveSurfer visualReady). */
    audioReady,
    loadError,
    isPlaying,
    duration,
    currentTime,
    refitFitAllIfNeeded,
    syncShellLayoutForZoom,
    flushDeferredPeaksLoad: () => flushDeferredPeaksLoadRef.current?.(),
    ...playback,
    seek,
    seekBlankToTime,
    seekByDelta,
    ...globalPlayback,
    segmentLoopPlayback: segmentPlayback.segmentLoopPlayback,
    isSelectedSegmentPlaying: segmentPlayback.isSelectedSegmentPlaying,
    playbackChromeEpoch: segmentPlayback.playbackChromeEpoch,
    playheadChromeMode,
    preserveLoopForNextSegmentSelect: segmentPlayback.preserveLoopForNextSegmentSelect,
    clearSegmentPlaybackBound: segmentPlayback.clearSegmentPlaybackBound,
    beginGlobalPlayback: segmentPlayback.beginGlobalPlayback,
    armBlankGlobalSpace: segmentPlayback.armBlankGlobalSpace,
    clearBlankGlobalSpaceArm: segmentPlayback.clearBlankGlobalSpaceArm,
    isBlankGlobalSpaceArmed: segmentPlayback.isBlankGlobalSpaceArmed,
    isSegmentPlaybackSession: segmentPlayback.isSegmentPlaybackSession,
    getPlaybackSession: segmentPlayback.getPlaybackSession,
    handleToggleSelectedWaveformLoop: segmentPlayback.handleToggleSelectedWaveformLoop,
    playSegmentAtIndex,
    handleToggleSelectedWaveformPlay,
    dispatchTransportIntent: dispatchTransport,
    togglePlay,
    toggleGlobalPlay,
    formatMediaTime,
    destroyWave,
    cancelInFlightZoom,
    peaksHotSwitchPending: zoomSync.peaksHotSwitchPending,
    peaksApplied: zoomSync.peaksApplied,
    exportMinimapPeaks,
    syncWaveSurferScrollFromTier,
  };
}
