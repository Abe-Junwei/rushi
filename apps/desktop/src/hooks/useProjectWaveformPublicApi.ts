import { formatMediaTime } from "../utils/formatMediaTime";
import { exportMinimapPeaksFromWaveSurfer } from "../services/waveform/minimapPeaksSource";
import type { useWaveformPlayback } from "./useWaveformPlayback";
import type { useWaveformGlobalPlayback } from "./useWaveformGlobalPlayback";
import type { useWaveformSegmentPlaybackControls } from "./useWaveformSegmentPlaybackControls";
import type { useWaveformZoomSync } from "./useWaveformZoomSync";
import type WaveSurfer from "wavesurfer.js";

type PlaybackApi = ReturnType<typeof useWaveformPlayback>;
type GlobalPlaybackApi = ReturnType<typeof useWaveformGlobalPlayback>;
type SegmentPlaybackApi = ReturnType<typeof useWaveformSegmentPlaybackControls>;
type ZoomSyncApi = ReturnType<typeof useWaveformZoomSync>;

/** Stable public surface for `useProjectWaveform` (callers keep ReturnType keys). */
export function buildProjectWaveformPublicApi(input: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  stickyShellRef: React.RefObject<HTMLDivElement | null>;
  stretchShellRef: React.RefObject<HTMLDivElement | null>;
  timelineShellRef: React.RefObject<HTMLDivElement | null>;
  peaksStageShellRef: React.RefObject<HTMLDivElement | null>;
  wsRef: React.MutableRefObject<WaveSurfer | null>;
  isReady: boolean;
  audioReady: boolean;
  loadError: string | null;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  refitFitAllIfNeeded: () => void;
  syncShellLayoutForZoom: () => void;
  flushDeferredPeaksLoadRef: React.MutableRefObject<(() => void) | undefined>;
  playback: PlaybackApi;
  globalPlayback: GlobalPlaybackApi;
  segmentPlayback: SegmentPlaybackApi;
  seek: (timeSec: number) => void;
  seekBlankToTime: (timeSec: number) => void;
  seekByDelta: (deltaSec: number) => void;
  playheadChromeMode: ReturnType<
    typeof import("../utils/waveformPlayheadChrome").resolveWaveformPlayheadChromeMode
  >;
  playSegmentAtIndex: (
    idx: number,
    playOpts?: { loop?: boolean; fromSec?: number },
  ) => Promise<void>;
  handleToggleSelectedWaveformPlay: () => Promise<void>;
  dispatchTransport: (intent: import("../services/waveform/transport").TransportIntent) => Promise<void>;
  togglePlay: () => Promise<void>;
  toggleGlobalPlay: () => Promise<void>;
  destroyWave: () => void;
  cancelInFlightZoom: () => void;
  zoomSync: ZoomSyncApi;
  syncWaveSurferScrollFromTier: (scrollLeftPx: number) => void;
}) {
  const {
    segmentPlayback: sp,
    playback,
    globalPlayback,
    zoomSync,
    wsRef,
    isReady,
    flushDeferredPeaksLoadRef,
  } = input;
  return {
    containerRef: input.containerRef,
    stickyShellRef: input.stickyShellRef,
    stretchShellRef: input.stretchShellRef,
    timelineShellRef: input.timelineShellRef,
    peaksStageShellRef: input.peaksStageShellRef,
    isReady,
    audioReady: input.audioReady,
    loadError: input.loadError,
    isPlaying: input.isPlaying,
    duration: input.duration,
    currentTime: input.currentTime,
    refitFitAllIfNeeded: input.refitFitAllIfNeeded,
    syncShellLayoutForZoom: input.syncShellLayoutForZoom,
    flushDeferredPeaksLoad: () => flushDeferredPeaksLoadRef.current?.(),
    ...playback,
    seek: input.seek,
    seekBlankToTime: input.seekBlankToTime,
    seekByDelta: input.seekByDelta,
    ...globalPlayback,
    segmentLoopPlayback: sp.segmentLoopPlayback,
    isSelectedSegmentPlaying: sp.isSelectedSegmentPlaying,
    playbackChromeEpoch: sp.playbackChromeEpoch,
    playheadChromeMode: input.playheadChromeMode,
    preserveLoopForNextSegmentSelect: sp.preserveLoopForNextSegmentSelect,
    clearSegmentPlaybackBound: sp.clearSegmentPlaybackBound,
    beginGlobalPlayback: sp.beginGlobalPlayback,
    armBlankGlobalSpace: sp.armBlankGlobalSpace,
    clearBlankGlobalSpaceArm: sp.clearBlankGlobalSpaceArm,
    isBlankGlobalSpaceArmed: sp.isBlankGlobalSpaceArmed,
    isSegmentPlaybackSession: sp.isSegmentPlaybackSession,
    getPlaybackSession: sp.getPlaybackSession,
    handleToggleSelectedWaveformLoop: sp.handleToggleSelectedWaveformLoop,
    playSegmentAtIndex: input.playSegmentAtIndex,
    handleToggleSelectedWaveformPlay: input.handleToggleSelectedWaveformPlay,
    dispatchTransportIntent: input.dispatchTransport,
    togglePlay: input.togglePlay,
    toggleGlobalPlay: input.toggleGlobalPlay,
    formatMediaTime,
    destroyWave: input.destroyWave,
    cancelInFlightZoom: input.cancelInFlightZoom,
    peaksHotSwitchPending: zoomSync.peaksHotSwitchPending,
    peaksApplied: zoomSync.peaksApplied,
    exportMinimapPeaks: (overviewWidthPx: number) =>
      isReady ? exportMinimapPeaksFromWaveSurfer(wsRef.current, overviewWidthPx) : null,
    syncWaveSurferScrollFromTier: input.syncWaveSurferScrollFromTier,
  };
}
