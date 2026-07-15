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
  const useNativeTransport = isTauriRuntime() && Boolean(mediaDiskPath);

  const globalPlayback = useWaveformGlobalPlayback(
    shell.wsRef,
    shell.isReady,
    shell.transportRef,
    useNativeTransport,
  );
  const applyGlobalPlaybackRateRef = useRef(globalPlayback.applyGlobalPlaybackRate);
  applyGlobalPlaybackRateRef.current = globalPlayback.applyGlobalPlaybackRate;

  const playback = useWaveformPlayback(
    shell.wsRef,
    shell.containerRef,
    shell.isReady,
    shell.layoutDurationSecRef,
    shell.layoutTimelineWidthPxRef,
    applyGlobalPlaybackRateRef,
    options.tierScrollRef,
    options.tierViewportMetricsRef,
    shell.commitSeekUi,
    options.beginVisualSeekRef,
    options.endVisualSeekRef,
    options.getDisplayPlayheadTimeSecRef,
    options.snapPlaybackViewportAfterSeekRef,
    shell.transportRef,
    useNativeTransport,
  );
  const segmentPlayback = useWaveformSegmentPlaybackControls({
    wsRef: shell.wsRef,
    transportRef: shell.transportRef,
    transportEpoch: shell.transportEpoch,
    requireTransport: useNativeTransport,
    isReady: shell.isReady,
    segments,
    selectedIdx,
    getGlobalPlaybackRate: () => globalPlayback.globalPlaybackRate,
    getPlayheadTime: playback.getPlayheadTime,
    getAuthorityPlayheadTimeSec: playback.getAuthorityPlayheadTimeSec,
    syncDisplayPlayheadAfterSeekRef: options.syncDisplayPlayheadAfterSeekRef,
    beginVisualSeekRef: options.beginVisualSeekRef,
    endVisualSeekRef: options.endVisualSeekRef,
    layoutDurationSecRef: shell.layoutDurationSecRef,
    commitSeekUi: shell.commitSeekUi,
  });

  const segmentsRef = useRef(segments);
  reconcileSegmentsRefWithState(segmentsRef, segments);
  const selectedIdxForTransportRef = useRef(selectedIdx);
  selectedIdxForTransportRef.current = selectedIdx;

  const tierChrome = useProjectWaveformTierChrome({
    wsRef: shell.wsRef,
    tierScrollRef: options.tierScrollRef,
    tierViewportMetricsRef: options.tierViewportMetricsRef,
  });

  const transport = useProjectWaveformTransport({
    wsRef: shell.wsRef,
    transportRef: shell.transportRef,
    useNativeTransport,
    isReady: shell.isReady,
    isPlaying: shell.isPlaying,
    layoutDurationSecRef: shell.layoutDurationSecRef,
    optsRef: shell.optsRef,
    segmentsRef,
    selectedIdxForTransportRef,
    commitSeekUi: shell.commitSeekUi,
    playback,
    segmentPlayback,
  });

  const mountRefs = useMemo(
    () => ({
      optsRef: shell.optsRef,
      containerRef: shell.containerRef,
      wsRef: shell.wsRef,
      wsUnsubsRef: shell.wsUnsubsRef,
      minPxPerSecRef: shell.minPxPerSecRef,
      peakCacheRef: shell.peakCacheRef,
      layoutDurationSecRef: shell.layoutDurationSecRef,
      waveformHeightRef: shell.waveformHeightRef,
      appliedWaveformHeightRef: shell.appliedWaveformHeightRef,
      pendingAppliedWaveformHeightRef: shell.pendingAppliedWaveformHeightRef,
      appliedZoom: shell.appliedZoom,
      syncTierScrollAfterRenderRef: tierChrome.syncTierScrollAfterRenderRef,
      getTierScrollLeftPxRef: tierChrome.getTierScrollLeftPxRef,
      lastTimeUiCommitRef: shell.lastTimeUiCommitRef,
      lastTimeUiCommitMsRef: shell.lastTimeUiCommitMsRef,
      scrollNotifyRafRef: shell.scrollNotifyRafRef,
      pendingScrollLeftRef: shell.pendingScrollLeftRef,
      setLoadError: shell.setLoadError,
      setIsReady: shell.setIsReady,
      setIsPlaying: shell.setIsPlaying,
      setDuration: shell.setDuration,
      setCurrentTime: shell.setCurrentTime,
    }),
    [
      shell.appliedZoom,
      shell.layoutDurationSecRef,
      tierChrome.getTierScrollLeftPxRef,
      tierChrome.syncTierScrollAfterRenderRef,
    ],
  );

  const destroyWave = useProjectWaveformDestroy(shell.clearWsListeners, mountRefs, mountRefs);
  useProjectWaveformMount(
    mediaUrl,
    mediaDiskPath,
    shell.deferDecodeMount,
    useNativeTransport,
    mountRefs,
    destroyWave,
  );

  useNativePlaybackController({
    enabled: useNativeTransport,
    mediaDiskPath,
    layoutDurationSecRef: shell.layoutDurationSecRef,
    peakCacheRef: shell.peakCacheRef,
    transportRef: shell.transportRef,
    applyGlobalPlaybackRate: globalPlayback.applyGlobalPlaybackRate,
    onWsAudioprocessRef: options.onWsAudioprocessRef,
    lastTimeUiCommitRef: shell.lastTimeUiCommitRef,
    setIsPlaying: shell.setIsPlaying,
    setDuration: shell.setDuration,
    setCurrentTime: shell.setCurrentTime,
    setLoadError: shell.setLoadError,
    setAudioReady: shell.setAudioReady,
    onTransportEpoch: shell.bumpTransportEpoch,
  });

  const { refitFitAllIfNeeded, syncShellLayoutForZoom } = useWaveformViewportController({
    wsRef: shell.wsRef,
    containerRef: shell.containerRef,
    stickyShellRef: shell.stickyShellRef,
    stretchShellRef: shell.stretchShellRef,
    tierScrollRef: options.tierScrollRef,
    isReady: shell.isReady,
    deferDecodeMount: shell.deferDecodeMount,
    onAfterViewportResizeRef: options.onAfterViewportResizeRef,
    syncScrollAfterRender: () => {
      tierChrome.requestViewportChromeFrame();
    },
    refitFitAllPxPerSec: options.refitFitAllPxPerSec,
    appliedZoom: shell.appliedZoom,
    onFitAllPxPerSecRefit: options.onFitAllPxPerSecRefit,
    layoutDurationSecRef: shell.layoutDurationSecRef,
    layoutTimelineWidthPxRef: shell.layoutTimelineWidthPxRef,
    timelineShellRef: shell.timelineShellRef,
    peaksStageShellRef: shell.peaksStageShellRef,
    viewportResizeHoldRef: shell.viewportResizeHoldRef,
  });

  const zoomSync = useWaveformZoomSync({
    wsRef: shell.wsRef,
    isReady: shell.isReady,
    isPlaying: shell.isPlaying,
    hotSwitchWhilePlayingRef: shell.hotSwitchWhilePlayingRef,
    hotSwitchWhilePlaying: shell.hotSwitchWhilePlaying,
    disabled: true,
    layoutPxPerSec,
    drawPxPerSec,
    appliedZoom: shell.appliedZoom,
    peakCache,
    peakCacheGeneration: options.peakCacheGeneration ?? 0,
    peakCacheRef: shell.peakCacheRef,
    layoutDurationSecRef: shell.layoutDurationSecRef,
    layoutDurationSec: options.layoutDurationSec ?? 0,
    mediaUrl,
    onZoomAppliedRef: shell.onZoomAppliedRef,
    cancelInFlightZoomRef: shell.cancelInFlightZoomRef,
    viewportResizeHoldRef: shell.viewportResizeHoldRef,
    flushDeferredPeaksLoadRef: shell.flushDeferredPeaksLoadRef,
  });

  useWaveformHeightSync({
    wsRef: shell.wsRef,
    containerRef: shell.containerRef,
    waveformHeightPx,
    isReady: shell.isReady,
    disabled,
    appliedWaveformHeightRef: shell.appliedWaveformHeightRef,
    pendingAppliedWaveformHeightRef: shell.pendingAppliedWaveformHeightRef,
  });

  useEffect(() => {
    const ws = shell.wsRef.current;
    if (!ws || !shell.isReady) return;
    ws.toggleInteraction(!disabled);
  }, [disabled, shell.isReady, shell.wsRef]);

  useEffect(() => {
    segmentPlayback.clearBlankGlobalSpaceArm();
  }, [mediaUrl, segmentPlayback.clearBlankGlobalSpaceArm]);

  return buildProjectWaveformPublicApi({
    containerRef: shell.containerRef,
    stickyShellRef: shell.stickyShellRef,
    stretchShellRef: shell.stretchShellRef,
    timelineShellRef: shell.timelineShellRef,
    peaksStageShellRef: shell.peaksStageShellRef,
    wsRef: shell.wsRef,
    isReady: shell.isReady,
    audioReady: shell.audioReady,
    loadError: shell.loadError,
    isPlaying: shell.isPlaying,
    duration: shell.duration,
    currentTime: shell.currentTime,
    refitFitAllIfNeeded,
    syncShellLayoutForZoom,
    flushDeferredPeaksLoadRef: shell.flushDeferredPeaksLoadRef,
    playback,
    globalPlayback,
    segmentPlayback,
    seek: transport.seek,
    seekBlankToTime: transport.seekBlankToTime,
    seekByDelta: transport.seekByDelta,
    playheadChromeMode: transport.playheadChromeMode,
    playSegmentAtIndex: transport.playSegmentAtIndex,
    handleToggleSelectedWaveformPlay: transport.handleToggleSelectedWaveformPlay,
    dispatchTransport: transport.dispatchTransport,
    togglePlay: transport.togglePlay,
    toggleGlobalPlay: transport.toggleGlobalPlay,
    destroyWave,
    cancelInFlightZoom: shell.cancelInFlightZoom,
    zoomSync,
    syncWaveSurferScrollFromTier: tierChrome.syncWaveSurferScrollFromTier,
  });
}
