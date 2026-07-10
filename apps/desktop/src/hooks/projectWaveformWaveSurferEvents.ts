import type WaveSurfer from "wavesurfer.js";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";
import { logDesktopUi } from "../services/desktopUiLog";
import { requestWaveformSegmentBandPaint } from "../utils/waveformSegmentBandPaint";
import {
  logWaveSurferGeomDeferred,
  readWaveSurferChannelCoverageSec,
  subscribeWaveSurferAfterRender,
  applyWaveSurferProgressWithoutClip,
} from "../services/waveform/waveformSurferProgressCoverage";

import { probeWaveformAssetFetchParity } from "../services/waveform/waveformAssetFetchParity";
type BindWaveformEventsParams = {
  ws: WaveSurfer;
  disposed: () => boolean;
  mediaUrl: string | null | undefined;
  mediaDiskPath: string | null | undefined;
  optsRef: { current: UseProjectWaveformOptions };
  minPxPerSecRef: { current: number };
  lastTimeUiCommitRef: { current: number };
  lastTimeUiCommitMsRef: { current: number };
  pendingScrollLeftRef: { current: number };
  scrollNotifyRafRef: { current: number };
  pendingAppliedWaveformHeightRef: { current: number | null };
  appliedWaveformHeightRef: { current: number };
  syncTierScrollAfterRenderRef: { current: () => void };
  setLoadError: (value: string | null) => void;
  setIsReady: (value: boolean) => void;
  setIsPlaying: (value: boolean) => void;
  setDuration: (value: number) => void;
  setCurrentTime: (value: number) => void;
};

export function bindProjectWaveformWaveSurferEvents(
  params: BindWaveformEventsParams,
): Array<() => void> {
  const {
    ws,
    disposed,
    mediaUrl,
    mediaDiskPath,
    optsRef,
    minPxPerSecRef: _minPxPerSecRef,
    lastTimeUiCommitRef,
    lastTimeUiCommitMsRef,
    pendingScrollLeftRef: _pendingScrollLeftRef,
    scrollNotifyRafRef: _scrollNotifyRafRef,
    pendingAppliedWaveformHeightRef,
    appliedWaveformHeightRef,
    syncTierScrollAfterRenderRef,
    setLoadError,
    setIsReady,
    setIsPlaying,
    setDuration,
    setCurrentTime,
  } = params;
  void _minPxPerSecRef;
  void _pendingScrollLeftRef;
  void _scrollNotifyRafRef;

  const scheduleSegmentBandPaint = () => {
    requestWaveformSegmentBandPaint();
  };

  return [
    ws.on("ready", (d) => {
      if (disposed()) return;
      setLoadError(null);
      setIsReady(true);
      setDuration(d);
      const channelSec = readWaveSurferChannelCoverageSec(ws);
      if (channelSec > 0 && d > 0 && channelSec < d * 0.95) {
        logDesktopUi(
          "WARN",
          `[wf-geom] channel_truncation channel_sec=${channelSec.toFixed(1)} ws_dur=${d.toFixed(1)}`,
        );
      }
      logWaveSurferGeomDeferred(ws, "ready", "");
      void probeWaveformAssetFetchParity("ws_ready", mediaDiskPath, mediaUrl);
      queueMicrotask(() => syncTierScrollAfterRenderRef.current());
    }),
    ws.on("error", (err) => {
      if (disposed()) return;
      if (err.name === "AbortError") return;
      const msg = err.message || String(err);
      logDesktopUi("ERROR", `waveform wavesurfer: ${msg}`);
      setLoadError(msg);
      setIsReady(false);
    }),
    ws.on("play", () => {
      setIsPlaying(true);
      const t = ws.getCurrentTime();
      lastTimeUiCommitRef.current = t;
      optsRef.current.onWsAudioprocessRef?.current?.(t);
    }),
    ws.on("pause", () => {
      setIsPlaying(false);
      const t = ws.getCurrentTime();
      lastTimeUiCommitRef.current = t;
      // Freeze display clock same-stack as media pause (before React isPlaying=false).
      optsRef.current.syncDisplayPlayheadAfterSeekRef?.current?.(t);
      if (!disposed()) {
        setCurrentTime(t);
      }
    }),
    ws.on("finish", () => {
      setIsPlaying(false);
      const t = ws.getCurrentTime();
      lastTimeUiCommitRef.current = t;
      optsRef.current.syncDisplayPlayheadAfterSeekRef?.current?.(t);
      if (!disposed()) {
        setCurrentTime(t);
      }
    }),
    ws.on("timeupdate", (t) => {
      if (disposed()) return;
      lastTimeUiCommitRef.current = t;
      if (ws.isPlaying()) {
        return;
      }
      setCurrentTime(t);
      scheduleSegmentBandPaint();
    }),
    ws.on("audioprocess", (t) => {
      if (disposed()) return;
      lastTimeUiCommitRef.current = t;
      if (!ws.isPlaying()) return;
      optsRef.current.onWsAudioprocessRef?.current?.(t);
    }),
    ws.on("seeking", (t) => {
      if (disposed()) return;
      lastTimeUiCommitRef.current = t;
      lastTimeUiCommitMsRef.current = performance.now();
      // Paused WS-only seeks (e.g. peaks reload) bypass imperative sync; refresh
      // visual clock + band subscribers. Playing seeks rely on audioprocess / prior sync.
      if (!ws.isPlaying()) {
        optsRef.current.syncDisplayPlayheadAfterSeekRef?.current?.(t);
      }
      setCurrentTime(t);
      const duration = ws.getDuration();
      if (duration > 0) {
        applyWaveSurferProgressWithoutClip(ws, t / duration);
      }
      scheduleSegmentBandPaint();
      queueMicrotask(() => syncTierScrollAfterRenderRef.current());
    }),
    ws.on("scroll", () => {
      if (disposed()) return;
    }),
    ws.on("zoom", () => {
      if (disposed()) return;
    }),
    subscribeWaveSurferAfterRender(ws, () => {
      if (disposed()) return;
      syncTierScrollAfterRenderRef.current();
      const appliedHeight = pendingAppliedWaveformHeightRef.current;
      if (appliedHeight == null) return;
      pendingAppliedWaveformHeightRef.current = null;
      appliedWaveformHeightRef.current = appliedHeight;
      optsRef.current.onWaveformHeightApplied?.(appliedHeight);
    }),
  ];
}
