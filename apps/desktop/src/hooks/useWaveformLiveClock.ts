import { useEffect, useRef, useState } from "react";

/** 播放中用 rAF 读 playhead；React 状态节流到 ~250ms，playhead 线可每帧直写 DOM。 */
export function useWaveformLiveClock(args: {
  isPlaying: boolean;
  isReady: boolean;
  getPlayheadTime: () => number;
  formatMediaTime: (sec: number) => string;
  durationSec: number;
  onPlayheadMove?: (timeSec: number, leftPct: number) => void;
}) {
  const { isPlaying, isReady, getPlayheadTime, formatMediaTime, durationSec, onPlayheadMove } = args;
  const [displayTimeSec, setDisplayTimeSec] = useState(0);
  const getPlayheadTimeRef = useRef(getPlayheadTime);
  const onPlayheadMoveRef = useRef(onPlayheadMove);
  getPlayheadTimeRef.current = getPlayheadTime;
  onPlayheadMoveRef.current = onPlayheadMove;

  useEffect(() => {
    if (!isReady) {
      setDisplayTimeSec(0);
      return;
    }

    let rafId = 0;
    let lastUiCommitMs = 0;

    const applyTime = (t: number, forceUi: boolean) => {
      const dur = Math.max(durationSec, 1e-6);
      const leftPct = Math.max(-1, Math.min(101, (t / dur) * 100));
      onPlayheadMoveRef.current?.(t, leftPct);
      const now = performance.now();
      if (forceUi || now - lastUiCommitMs >= 250) {
        lastUiCommitMs = now;
        setDisplayTimeSec(t);
      }
    };

    if (!isPlaying) {
      applyTime(getPlayheadTimeRef.current(), true);
      return;
    }

    const tick = () => {
      applyTime(getPlayheadTimeRef.current(), false);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [durationSec, isPlaying, isReady]);

  return {
    displayTimeSec,
    displayTimeLabel: formatMediaTime(displayTimeSec),
    durationLabel: formatMediaTime(durationSec),
  };
}
