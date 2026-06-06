import { useCallback, useEffect, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import WaveSurfer from "wavesurfer.js";
import { COLORS } from "../config/tokens";
import type { PeakCache } from "../services/waveform/PeakCache";
import { quantizePxPerSecForPeaksLoad } from "../utils/pxPerSec";
import { resolveLayoutDurationSec } from "../utils/waveformTimelineMetrics";
import {
  markAppliedPeaks,
  markAppliedZoomWs,
  resetAppliedPeaks,
  type WaveformAppliedZoomState,
} from "../utils/waveformAppliedZoom";
import { WAVEFORM_DECODE_SAMPLE_RATE } from "../services/waveform/waveformZoomSyncEngine";
import { installWaveSurferProgressAbortWarnFilter } from "../services/waveform/waveSurferProgressAbortWarn";
import { bindProjectWaveformWaveSurferEvents } from "./projectWaveformWaveSurferEvents";
import { logDesktopUi } from "../services/desktopUiLog";
import type { UseProjectWaveformOptions } from "./useProjectWaveformTypes";

installWaveSurferProgressAbortWarnFilter();

async function waitForWaveformContainer(
  readContainer: () => HTMLDivElement | null,
  isDisposed: () => boolean,
  maxAttempts = 60,
): Promise<HTMLDivElement | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (isDisposed()) return null;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    const el = readContainer();
    if (el?.isConnected) return el;
  }
  return null;
}

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
  appliedZoom: WaveformAppliedZoomState;
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
  peakCacheGeneration: number,
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
    appliedZoom,
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
      const el = await waitForWaveformContainer(() => containerRef.current, () => disposed);
      if (disposed) return;
      if (!el) {
        logDesktopUi("WARN", "waveform mount: container not connected after wait");
        setLoadError("波形容器未就绪，请切换文件或重新打开项目");
        return;
      }

      const wantDragCreate = Boolean(optsRef.current.onWaveformCreateRange);
      const initialMps = minPxPerSecRef.current;
      const initialH = waveformHeightRef.current;
      pendingAppliedWaveformHeightRef.current = initialH;
      markAppliedZoomWs(appliedZoom, initialMps);

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
          markAppliedPeaks(appliedZoom, true, loadPx);
        } catch (err) {
          logDesktopUi(
            "ERROR",
            `waveform mount peaks bootstrap: ${err instanceof Error ? err.message : String(err)}`,
          );
          resetAppliedPeaks(appliedZoom);
        }
      } else {
        resetAppliedPeaks(appliedZoom);
      }

      if (disposed) return;
      const mountEl = containerRef.current;
      if (!mountEl?.isConnected) return;

      const ws = WaveSurfer.create({
        container: mountEl,
        url: mediaUrl,
        peaks,
        duration,
        height: initialH,
        normalize: true,
        maxPeak: 1,
        sampleRate: peaks ? undefined : WAVEFORM_DECODE_SAMPLE_RATE,
        waveColor: COLORS.waveformWave,
        progressColor: COLORS.waveformProgress,
        cursorColor: COLORS.indigo,
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
    peakCacheGeneration,
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
    appliedZoom,
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
    "wsRef" | "scrollNotifyRafRef" | "pendingAppliedWaveformHeightRef" | "appliedZoom"
  >,
  setters: Pick<MountRefs, "setIsReady" | "setIsPlaying" | "setDuration" | "setCurrentTime">,
) {
  const { wsRef, scrollNotifyRafRef, pendingAppliedWaveformHeightRef, appliedZoom } = refs;
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
    resetAppliedPeaks(appliedZoom);
    if (scrollNotifyRafRef.current) {
      cancelAnimationFrame(scrollNotifyRafRef.current);
      scrollNotifyRafRef.current = 0;
    }
  }, [
    clearWsListeners,
    wsRef,
    scrollNotifyRafRef,
    pendingAppliedWaveformHeightRef,
    appliedZoom,
    setIsReady,
    setIsPlaying,
    setDuration,
    setCurrentTime,
  ]);
}
