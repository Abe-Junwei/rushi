import { useCallback, useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import WaveSurfer from "wavesurfer.js";
import { COLORS } from "../config/tokens";
import type { PeakCache } from "../services/waveform/PeakCache";
import { quantizePxPerSecForPeaksLoad } from "../utils/pxPerSec";
import { resolveLayoutDurationSec } from "../utils/waveformTimelineMetrics";
import { bindProjectWaveformWaveSurferEvents } from "./projectWaveformWaveSurferEvents";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";

const DECODE_SAMPLE_RATE = 8000;

type MountRefs = {
  optsRef: MutableRefObject<UseProjectWaveformOptions>;
  containerRef: RefObject<HTMLDivElement | null>;
  wsRef: MutableRefObject<WaveSurfer | null>;
  wsUnsubsRef: MutableRefObject<Array<() => void>>;
  minPxPerSecRef: MutableRefObject<number>;
  peakCacheRef: MutableRefObject<PeakCache | null>;
  layoutDurationSecRef: MutableRefObject<number>;
  waveformHeightRef: MutableRefObject<number>;
  appliedWaveformHeightRef: MutableRefObject<number>;
  pendingAppliedWaveformHeightRef: MutableRefObject<number | null>;
  appliedZoomPxPerSecRef: MutableRefObject<number>;
  appliedPeaksRef: MutableRefObject<boolean>;
  appliedPeaksLoadPxPerSecRef: MutableRefObject<number>;
  syncTierScrollAfterRenderRef: MutableRefObject<() => void>;
  lastTimeUiCommitRef: MutableRefObject<number>;
  lastTimeUiCommitMsRef: MutableRefObject<number>;
  scrollNotifyRafRef: MutableRefObject<number>;
  pendingScrollLeftRef: MutableRefObject<number>;
  setLoadError: Dispatch<SetStateAction<string | null>>;
  setIsReady: Dispatch<SetStateAction<boolean>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setDuration: Dispatch<SetStateAction<number>>;
  setCurrentTime: Dispatch<SetStateAction<number>>;
};

export function useProjectWaveformMount(
  mediaUrl: string | null | undefined,
  deferDecodeMount: boolean,
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
    layoutDurationSecRef,
    waveformHeightRef,
    appliedWaveformHeightRef,
    pendingAppliedWaveformHeightRef,
    appliedZoomPxPerSecRef,
    appliedPeaksRef,
    appliedPeaksLoadPxPerSecRef,
    syncTierScrollAfterRenderRef,
    lastTimeUiCommitRef,
    lastTimeUiCommitMsRef,
    scrollNotifyRafRef,
    pendingScrollLeftRef,
    setLoadError,
    setIsReady,
    setIsPlaying,
    setDuration,
    setCurrentTime,
  } = refs;

  useEffect(() => {
    destroyWave();
    if (!mediaUrl) {
      setLoadError(null);
      return;
    }
    if (deferDecodeMount) {
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

      const cache = peakCacheRef.current;
      const layoutDur = resolveLayoutDurationSec({
        layoutDurationSecRef: layoutDurationSecRef.current,
        peakCacheDurationSec: cache?.durationSec ?? 0,
      });

      let peaks: Array<Float32Array | number[]> | undefined;
      let duration: number | undefined;
      if (cache && layoutDur > 0) {
        try {
          const loadPx = quantizePxPerSecForPeaksLoad(initialMps);
          const bundle = await cache.getWaveSurferPeaksAsync(loadPx, layoutDur);
          peaks = bundle.peaks;
          duration = bundle.duration;
          appliedPeaksRef.current = true;
          appliedPeaksLoadPxPerSecRef.current = loadPx;
        } catch {
          appliedPeaksRef.current = false;
          appliedPeaksLoadPxPerSecRef.current = Number.NaN;
        }
      } else {
        appliedPeaksRef.current = false;
        appliedPeaksLoadPxPerSecRef.current = Number.NaN;
      }

      const ws = WaveSurfer.create({
        container: el,
        url: mediaUrl,
        peaks,
        duration,
        height: initialH,
        normalize: true,
        maxPeak: 1,
        sampleRate: peaks ? undefined : DECODE_SAMPLE_RATE,
        waveColor: COLORS.waveformWave,
        progressColor: COLORS.waveformProgress,
        cursorColor: COLORS.waveformCursor,
        cursorWidth: 1,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        minPxPerSec: initialMps,
        dragToSeek: !wantDragCreate,
        interact: !optsRef.current.disabled,
        autoScroll: false,
        autoCenter: false,
        hideScrollbar: true,
        fillParent: false,
      });

      wsRef.current = ws;

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
          syncTierScrollAfterRenderRef,
          setLoadError,
          setIsReady,
          setIsPlaying,
          setDuration,
          setCurrentTime,
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
    deferDecodeMount,
    destroyWave,
    optsRef,
    containerRef,
    wsRef,
    wsUnsubsRef,
    minPxPerSecRef,
    layoutDurationSecRef,
    waveformHeightRef,
    appliedWaveformHeightRef,
    pendingAppliedWaveformHeightRef,
    appliedZoomPxPerSecRef,
    appliedPeaksRef,
    appliedPeaksLoadPxPerSecRef,
    lastTimeUiCommitRef,
    lastTimeUiCommitMsRef,
    scrollNotifyRafRef,
    pendingScrollLeftRef,
    setLoadError,
    setIsReady,
    setIsPlaying,
    setDuration,
    setCurrentTime,
  ]);
}

export function useProjectWaveformDestroy(
  clearWsListeners: () => void,
  refs: Pick<
    MountRefs,
    | "wsRef"
    | "scrollNotifyRafRef"
    | "pendingAppliedWaveformHeightRef"
    | "appliedPeaksRef"
    | "appliedPeaksLoadPxPerSecRef"
  >,
  setters: Pick<MountRefs, "setIsReady" | "setIsPlaying" | "setDuration" | "setCurrentTime">,
) {
  const { wsRef, scrollNotifyRafRef, pendingAppliedWaveformHeightRef, appliedPeaksRef, appliedPeaksLoadPxPerSecRef } =
    refs;
  const { setIsReady, setIsPlaying, setDuration, setCurrentTime } = setters;

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
    pendingAppliedWaveformHeightRef.current = null;
    appliedPeaksRef.current = false;
    appliedPeaksLoadPxPerSecRef.current = Number.NaN;
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
    appliedPeaksLoadPxPerSecRef,
    setIsReady,
    setIsPlaying,
    setDuration,
    setCurrentTime,
  ]);
}
