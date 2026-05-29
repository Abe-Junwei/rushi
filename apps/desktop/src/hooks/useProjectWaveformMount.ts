import { useCallback, useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import WaveSurfer from "wavesurfer.js";
import { COLORS } from "../config/tokens";
import type { WaveformRulerView } from "../utils/waveformViewport";
import type { PeakCache } from "../services/waveform/PeakCache";
import { bindProjectWaveformWaveSurferEvents } from "./projectWaveformWaveSurferEvents";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";

type MountRefs = {
  optsRef: MutableRefObject<UseProjectWaveformOptions>;
  containerRef: RefObject<HTMLDivElement | null>;
  wsRef: MutableRefObject<WaveSurfer | null>;
  wsUnsubsRef: MutableRefObject<Array<() => void>>;
  minPxPerSecRef: MutableRefObject<number>;
  peakCacheRef: MutableRefObject<PeakCache | null>;
  waveformHeightRef: MutableRefObject<number>;
  appliedWaveformHeightRef: MutableRefObject<number>;
  pendingAppliedWaveformHeightRef: MutableRefObject<number | null>;
  appliedZoomPxPerSecRef: MutableRefObject<number>;
  appliedPeaksRef: MutableRefObject<boolean>;
  lastTimeUiCommitRef: MutableRefObject<number>;
  lastTimeUiCommitMsRef: MutableRefObject<number>;
  scrollNotifyRafRef: MutableRefObject<number>;
  pendingScrollLeftRef: MutableRefObject<number>;
  setLoadError: Dispatch<SetStateAction<string | null>>;
  setIsReady: Dispatch<SetStateAction<boolean>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setDuration: Dispatch<SetStateAction<number>>;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  setRulerView: Dispatch<SetStateAction<WaveformRulerView | null>>;
};

export function useProjectWaveformMount(
  mediaUrl: string | null | undefined,
  refs: MountRefs,
  destroyWave: () => void,
) {
  const {
    optsRef,
    containerRef,
    wsRef,
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
  } = refs;

  useEffect(() => {
    destroyWave();
    if (!mediaUrl) {
      setLoadError(null);
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    const run = async () => {
      await new Promise<void>((r) => {
        requestAnimationFrame(() => r());
      });
      if (disposed) return;
      const el = containerRef.current;
      if (!el?.isConnected) return;

      const wantDragCreate = Boolean(optsRef.current.onWaveformCreateRange);
      const initialMps = minPxPerSecRef.current;
      const initialH = waveformHeightRef.current;
      pendingAppliedWaveformHeightRef.current = initialH;
      appliedZoomPxPerSecRef.current = initialMps;
      let peakBundle: ReturnType<PeakCache["getWaveSurferPeaks"]> | undefined;
      try {
        peakBundle = peakCacheRef.current?.getWaveSurferPeaks(initialMps);
      } catch {
        peakBundle = undefined;
      }
      const usePeaksDraw = Boolean(peakBundle);
      if (usePeaksDraw) {
        appliedPeaksRef.current = true;
      }
      const ws = WaveSurfer.create({
        container: el,
        url: mediaUrl,
        height: initialH,
        normalize: true,
        maxPeak: 1,
        sampleRate: peakBundle ? undefined : 8000,
        waveColor: usePeaksDraw ? "transparent" : COLORS.waveformWave,
        progressColor: usePeaksDraw ? "transparent" : COLORS.waveformProgress,
        cursorColor: COLORS.waveformCursor,
        cursorWidth: 1,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        minPxPerSec: initialMps,
        dragToSeek: !wantDragCreate,
        interact: !optsRef.current.disabled,
        autoScroll: !usePeaksDraw,
        autoCenter: false,
        hideScrollbar: true,
        ...(peakBundle
          ? {
              peaks: peakBundle.peaks,
              duration: peakBundle.duration,
            }
          : {}),
      });

      wsRef.current = ws;
      if (!usePeaksDraw) {
        appliedPeaksRef.current = false;
      }

      wsUnsubsRef.current.push(
        ...bindProjectWaveformWaveSurferEvents({
          ws,
          disposed: () => disposed,
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
        }),
      );
    };

    setLoadError(null);
    void run();

    return () => {
      disposed = true;
      destroyWave();
    };
  }, [
    mediaUrl,
    destroyWave,
    optsRef,
    containerRef,
    wsRef,
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
  ]);
}

export function useProjectWaveformDestroy(
  clearWsListeners: () => void,
  refs: Pick<MountRefs, "wsRef" | "scrollNotifyRafRef" | "pendingAppliedWaveformHeightRef" | "appliedPeaksRef">,
  setters: Pick<MountRefs, "setIsReady" | "setIsPlaying" | "setDuration" | "setCurrentTime" | "setRulerView">,
) {
  const { wsRef, scrollNotifyRafRef, pendingAppliedWaveformHeightRef, appliedPeaksRef } = refs;
  const { setIsReady, setIsPlaying, setDuration, setCurrentTime, setRulerView } = setters;

  return useCallback(() => {
    clearWsListeners();
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      try {
        ws.destroy();
      } catch {
        /* noop */
      }
    }
    setIsReady(false);
    setIsPlaying(false);
    setDuration(0);
    setCurrentTime(0);
    setRulerView(null);
    pendingAppliedWaveformHeightRef.current = null;
    appliedPeaksRef.current = false;
    if (scrollNotifyRafRef.current) {
      cancelAnimationFrame(scrollNotifyRafRef.current);
      scrollNotifyRafRef.current = 0;
    }
  }, [
    clearWsListeners,
    wsRef,
    scrollNotifyRafRef,
    pendingAppliedWaveformHeightRef,
    appliedPeaksRef,
    setIsReady,
    setIsPlaying,
    setDuration,
    setCurrentTime,
    setRulerView,
  ]);
}
