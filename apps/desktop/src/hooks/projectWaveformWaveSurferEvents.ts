import type WaveSurfer from "wavesurfer.js";
import { applyWaveSurferPeaksDrawMode } from "../services/waveform/waveSurferPeaksDraw";
import { resolveWaveformRulerView } from "../utils/waveformViewport";
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
  appliedPeaksRef: { current: boolean };
  setLoadError: (value: string | null) => void;
  setIsReady: (value: boolean) => void;
  setIsPlaying: (value: boolean) => void;
  setDuration: (value: number) => void;
  setCurrentTime: (value: number) => void;
  setRulerView: (value: ReturnType<typeof resolveWaveformRulerView>) => void;
};

export function bindProjectWaveformWaveSurferEvents(
  params: BindWaveformEventsParams,
): Array<() => void> {
  const {
    ws,
    disposed,
    optsRef,
    minPxPerSecRef,
    lastTimeUiCommitRef,
    lastTimeUiCommitMsRef,
    pendingScrollLeftRef,
    scrollNotifyRafRef,
    pendingAppliedWaveformHeightRef,
    appliedWaveformHeightRef,
    appliedPeaksRef,
    setLoadError,
    setIsReady,
    setIsPlaying,
    setDuration,
    setCurrentTime,
    setRulerView,
  } = params;

  const notifyScroll = () => {
    pendingScrollLeftRef.current = ws.getScroll();
    if (scrollNotifyRafRef.current) return;
    scrollNotifyRafRef.current = requestAnimationFrame(() => {
      scrollNotifyRafRef.current = 0;
      optsRef.current.onWaveformScroll?.(pendingScrollLeftRef.current);
    });
  };

  return [
    ws.on("ready", (d) => {
      if (disposed()) return;
      setLoadError(null);
      setIsReady(true);
      setDuration(d);
      setRulerView(
        resolveWaveformRulerView({
          durationSec: d,
          scrollLeftPx: ws.getScroll(),
          clientWidthPx: ws.getWidth(),
          pxPerSec: minPxPerSecRef.current,
        }),
      );
    }),
    ws.on("error", (err) => {
      if (disposed()) return;
      setLoadError(err.message || String(err));
      if (appliedPeaksRef.current) {
        appliedPeaksRef.current = false;
        applyWaveSurferPeaksDrawMode(ws, false);
      }
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
    ws.on("scroll", (_visibleStartTime, _visibleEndTime, scrollLeft) => {
      if (disposed()) return;
      pendingScrollLeftRef.current = scrollLeft;
      if (scrollNotifyRafRef.current) return;
      scrollNotifyRafRef.current = requestAnimationFrame(() => {
        scrollNotifyRafRef.current = 0;
        optsRef.current.onWaveformScroll?.(pendingScrollLeftRef.current);
      });
    }),
    ws.on("zoom", () => {
      if (disposed()) return;
      notifyScroll();
    }),
    ws.on("redrawcomplete", () => {
      if (disposed()) return;
      const appliedHeight = pendingAppliedWaveformHeightRef.current;
      if (appliedHeight == null) return;
      pendingAppliedWaveformHeightRef.current = null;
      appliedWaveformHeightRef.current = appliedHeight;
      optsRef.current.onWaveformHeightApplied?.(appliedHeight);
    }),
  ];
}
