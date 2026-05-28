import { useCallback } from "react";
import type WaveSurfer from "wavesurfer.js";
import { clientXToTimelinePx, timelinePxToTimeSec } from "../utils/waveformPointerTime";

export function useWaveformPlayback(
  wsRef: React.MutableRefObject<WaveSurfer | null>,
  containerRef: React.MutableRefObject<HTMLDivElement | null>,
  isReady: boolean,
  minPxPerSecRef: React.MutableRefObject<number>,
  interactionPxPerSecRef: React.MutableRefObject<number>,
  applyGlobalPlaybackRateRef: React.MutableRefObject<() => void>,
) {
  const seek = useCallback(
    (timeSec: number) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      const d = ws.getDuration() || 0;
      ws.setTime(Math.max(0, Math.min(timeSec, d > 0 ? d : timeSec)));
    },
    [isReady, wsRef],
  );

  const togglePlay = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    if (ws.isPlaying()) ws.pause();
    else {
      applyGlobalPlaybackRateRef.current();
      await ws.play();
    }
  }, [applyGlobalPlaybackRateRef, isReady, wsRef]);

  const getScrollLeft = useCallback((): number => {
    const ws = wsRef.current;
    if (!ws || !isReady) return 0;
    return ws.getScroll();
  }, [isReady, wsRef]);

  const setScrollLeft = useCallback(
    (pixels: number) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      ws.setScroll(pixels);
    },
    [isReady, wsRef],
  );

  const getPlayheadTime = useCallback((): number => {
    const ws = wsRef.current;
    if (!ws || !isReady) return 0;
    return ws.getCurrentTime();
  }, [isReady, wsRef]);

  const seekByDelta = useCallback(
    (deltaSec: number) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      const d = ws.getDuration() || 0;
      const t = Math.max(0, Math.min(d, ws.getCurrentTime() + deltaSec));
      ws.setTime(t);
    },
    [isReady, wsRef],
  );

  const clientXToTimeSec = useCallback(
    (clientX: number): number => {
      const ws = wsRef.current;
      const el = containerRef.current;
      if (!ws || !el || !isReady) return 0;
      const rect = el.getBoundingClientRect();
      const relPx = clientXToTimelinePx(clientX, rect.left);
      const mps = interactionPxPerSecRef.current ?? minPxPerSecRef.current ?? 56;
      const dur = ws.getDuration() || 0;
      return timelinePxToTimeSec(relPx, mps, dur);
    },
    [isReady, wsRef, containerRef, interactionPxPerSecRef, minPxPerSecRef],
  );

  return {
    seek,
    togglePlay,
    getScrollLeft,
    setScrollLeft,
    getPlayheadTime,
    seekByDelta,
    clientXToTimeSec,

  };
}
