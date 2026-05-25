import { useCallback } from "react";
import type WaveSurfer from "wavesurfer.js";

export function useWaveformPlayback(
  wsRef: React.MutableRefObject<WaveSurfer | null>,
  containerRef: React.MutableRefObject<HTMLDivElement | null>,
  isReady: boolean,
  minPxPerSecRef: React.MutableRefObject<number>,
  getViewportScrollPx?: () => number,
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
    else await ws.play();
  }, [isReady, wsRef]);

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
      ws.skip(deltaSec);
    },
    [isReady, wsRef],
  );

  const clientXToTimeSec = useCallback(
    (clientX: number): number => {
      const ws = wsRef.current;
      const el = containerRef.current;
      if (!ws || !el || !isReady) return 0;
      const rect = el.getBoundingClientRect();
      const visibleScrollPx = Math.max(getViewportScrollPx?.() ?? 0, ws.getScroll());
      const relPx = clientX - rect.left + visibleScrollPx;
      const mps = minPxPerSecRef.current ?? 56;
      const dur = ws.getDuration() || 0;
      const t = relPx / mps;
      return Math.max(0, Math.min(t, dur));
    },
    [getViewportScrollPx, isReady, wsRef, containerRef, minPxPerSecRef],
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
