import { useCallback } from "react";
import { resetAppliedPeaks } from "../utils/waveformAppliedZoom";
import type { ProjectWaveformMountRefs } from "./projectWaveformMountSupport";

/**
 * Tear down WaveSurfer visual host only.
 * Native {@link PlaybackTransport} lifecycle is owned by useNativePlaybackController
 * (destroying it here raced remounts and left requireTransport play dead).
 */
export function useProjectWaveformDestroy(
  clearWsListeners: () => void,
  refs: Pick<
    ProjectWaveformMountRefs,
    "wsRef" | "scrollNotifyRafRef" | "pendingAppliedWaveformHeightRef" | "appliedZoom"
  >,
  setters: Pick<
    ProjectWaveformMountRefs,
    "setIsReady" | "setIsPlaying" | "setDuration" | "setCurrentTime"
  >,
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
