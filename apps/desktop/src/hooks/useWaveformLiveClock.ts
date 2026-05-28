import { useEffect, useRef, useState, type RefObject } from "react";

/** 播放中用 rAF 读 playhead，避免 timeupdate 驱动整页 React 重绘。 */
export function useWaveformLiveClock(args: {
  isPlaying: boolean;
  isReady: boolean;
  getPlayheadTime: () => number;
  formatMediaTime: (sec: number) => string;
  durationSec: number;
  playheadRef?: RefObject<HTMLElement | null>;
}) {
  const { isPlaying, isReady, getPlayheadTime, formatMediaTime, durationSec, playheadRef } = args;
  const [displayTimeSec, setDisplayTimeSec] = useState(0);
  const getPlayheadTimeRef = useRef(getPlayheadTime);
  getPlayheadTimeRef.current = getPlayheadTime;

  useEffect(() => {
    if (!isReady) {
      setDisplayTimeSec(0);
      return;
    }
    if (!isPlaying) {
      const t = getPlayheadTimeRef.current();
      setDisplayTimeSec(t);
      if (playheadRef?.current) {
        const dur = Math.max(durationSec, 1e-6);
        playheadRef.current.style.left = `${Math.max(-1, Math.min(101, (t / dur) * 100))}%`;
      }
      return;
    }

    let rafId = 0;
    const tick = () => {
      const t = getPlayheadTimeRef.current();
      setDisplayTimeSec(t);
      if (playheadRef?.current) {
        const dur = Math.max(durationSec, 1e-6);
        playheadRef.current.style.left = `${Math.max(-1, Math.min(101, (t / dur) * 100))}%`;
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [durationSec, isPlaying, isReady, playheadRef]);

  return {
    displayTimeSec,
    displayTimeLabel: formatMediaTime(displayTimeSec),
    durationLabel: formatMediaTime(durationSec),
  };
}
