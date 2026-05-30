import type WaveSurfer from "wavesurfer.js";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";

type BindWaveformEventsParams = {
  ws: WaveSurfer;
  disposed: () => boolean;
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

  return [
    ws.on("ready", (d) => {
      if (disposed()) return;
      setLoadError(null);
      setIsReady(true);
      setDuration(d);
      queueMicrotask(() => syncTierScrollAfterRenderRef.current());
    }),
    ws.on("error", (err) => {
      if (disposed()) return;
      setLoadError(err.message || String(err));
      setIsReady(false);
    }),
    ws.on("play", () => setIsPlaying(true)),
    ws.on("pause", () => setIsPlaying(false)),
    ws.on("finish", () => setIsPlaying(false)),
    ws.on("timeupdate", (t) => {
      if (disposed()) return;
      lastTimeUiCommitRef.current = t;
      if (ws.isPlaying()) {
        const now = performance.now();
        if (now - lastTimeUiCommitMsRef.current < 250) return;
        lastTimeUiCommitMsRef.current = now;
      }
      setCurrentTime(t);
    }),
    ws.on("seeking", (t) => {
      if (disposed()) return;
      lastTimeUiCommitRef.current = t;
      lastTimeUiCommitMsRef.current = performance.now();
      setCurrentTime(t);
    }),
    ws.on("scroll", () => {
      if (disposed()) return;
    }),
    ws.on("zoom", () => {
      if (disposed()) return;
    }),
    ws.on("redrawcomplete", () => {
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
