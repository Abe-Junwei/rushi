import { useEffect, useMemo, useRef } from "react";
import { useWaveformHeightSync } from "./useWaveformHeightSync";
import { useWaveformPlayback } from "./useWaveformPlayback";
import { useWaveformGlobalPlayback } from "./useWaveformGlobalPlayback";
import { useWaveformSegmentPlaybackControls } from "./useWaveformSegmentPlaybackControls";
import { useWaveformZoomSync } from "./useWaveformZoomSync";
import { useWaveformViewportController } from "./useWaveformViewportController";
import { useProjectWaveformMount } from "./useProjectWaveformMount";
import { useProjectWaveformDestroy } from "./useProjectWaveformDestroy";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";
import { reconcileSegmentsRefWithState } from "../pages/segmentSegmentsRefSync";
import { isTauriRuntime } from "../config/env";
import { useNativePlaybackController } from "./useNativePlaybackController";
import { useProjectWaveformTierChrome } from "./useProjectWaveformTierChrome";
import { useProjectWaveformTransport } from "./useProjectWaveformTransport";
import { useProjectWaveformShellState } from "./useProjectWaveformShellState";
import { buildProjectWaveformPublicApi } from "./useProjectWaveformPublicApi";
import { WAVEFORM_HEIGHT_DEFAULT } from "../utils/waveformPrefs";

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
  } = options;

  const shell = useProjectWaveformShellState(options);
  const {
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
  } = shell;

  // Desktop Tauri: native transport is mandatory (ADR-0008 maturity).
  const useNativeTransport = isTauriRuntime() && Boolean(mediaDiskPath);

  const globalPlayback = useWaveformGlobalPlayback(
    wsRef,
    isReady,
    transportRef,
    useNativeTransport,
  );
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
    options.tierViewportMetricsRef,
    commitSeekUi,
    options.syncDisplayPlayheadAfterSeekRef,
    options.getDisplayPlayheadTimeSecRef,
    transportRef,
    useNativeTransport,
  );
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
    getAuthorityPlayheadTimeSec: playback.getAuthorityPlayheadTimeSec,
    syncDisplayPlayheadAfterSeekRef: options.syncDisplayPlayheadAfterSeekRef,
    layoutDurationSecRef,
    commitSeekUi,
  });

  const segmentsRef = useRef(segments);
  reconcileSegmentsRefWithState(segmentsRef, segments);
  const selectedIdxForTransportRef = useRef(selectedIdx);
  selectedIdxForTransportRef.current = selectedIdx;

  const {
    requestViewportChromeFrame,
    getTierScrollLeftPxRef,
    syncTierScrollAfterRenderRef,
    syncWaveSurferScrollFromTier,
  } = useProjectWaveformTierChrome({
    wsRef,
    tierScrollRef: options.tierScrollRef,
    tierViewportMetricsRef: options.tierViewportMetricsRef,
  });

  const {
    dispatchTransport,
    seek,
    seekBlankToTime,
    seekByDelta,
    playSegmentAtIndex,
    togglePlay,
    toggleGlobalPlay,
    handleToggleSelectedWaveformPlay,
    playheadChromeMode,
  } = useProjectWaveformTransport({
    wsRef,
    transportRef,
    useNativeTransport,
    isReady,
    isPlaying,
    layoutDurationSecRef,
    optsRef,
    segmentsRef,
    selectedIdxForTransportRef,
    commitSeekUi,
    playback,
    segmentPlayback,
  });

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
    [appliedZoom, getTierScrollLeftPxRef, layoutDurationSecRef, syncTierScrollAfterRenderRef],
  );

  const destroyWave = useProjectWaveformDestroy(clearWsListeners, mountRefs, mountRefs);

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
    setDuration,
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

  const zoomSync = useWaveformZoomSync({
    wsRef,
    isReady,
    isPlaying,
    hotSwitchWhilePlayingRef,
    hotSwitchWhilePlaying,
    disabled: true,
    layoutPxPerSec,
    drawPxPerSec,
    appliedZoom,
    peakCache,
    peakCacheGeneration: options.peakCacheGeneration ?? 0,
    peakCacheRef,
    layoutDurationSecRef,
    layoutDurationSec: options.layoutDurationSec ?? 0,
    mediaUrl,
    onZoomAppliedRef,
    cancelInFlightZoomRef,
    viewportResizeHoldRef,
    flushDeferredPeaksLoadRef,
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
  }, [disabled, isReady, wsRef]);

  useEffect(() => {
    segmentPlayback.clearBlankGlobalSpaceArm();
  }, [mediaUrl, segmentPlayback.clearBlankGlobalSpaceArm]);

  return buildProjectWaveformPublicApi({
    containerRef,
    stickyShellRef,
    stretchShellRef,
    timelineShellRef,
    peaksStageShellRef,
    wsRef,
    isReady,
    audioReady,
    loadError,
    isPlaying,
    duration,
    currentTime,
    refitFitAllIfNeeded,
    syncShellLayoutForZoom,
    flushDeferredPeaksLoadRef,
    playback,
    globalPlayback,
    segmentPlayback,
    seek,
    seekBlankToTime,
    seekByDelta,
    playheadChromeMode,
    playSegmentAtIndex,
    handleToggleSelectedWaveformPlay,
    dispatchTransport,
    togglePlay,
    toggleGlobalPlay,
    destroyWave,
    cancelInFlightZoom,
    zoomSync,
    syncWaveSurferScrollFromTier,
  });
}
