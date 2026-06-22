import { useEffect, useRef, useState } from "react";
import { playheadTimelineLeftPct } from "../utils/waveformProjection";

/** Ruler / toolbar label clock — reads {@link getDisplayPlayheadTimeSec} only. */
export function useWaveformLiveClock(args: {
  isPlaying: boolean;
  isReady: boolean;
  getDisplayPlayheadTimeSec: () => number;
  formatMediaTime: (sec: number) => string;
  durationSec: number;
  /** Paused seek commits — retriggers label sync without playing rAF bus. */
  currentTimeSec?: number;
  timelineWidthPx?: number;
  onPlayheadMove?: (timeSec: number, leftPct: number) => void;
  subscribePlayheadFrame?: (cb: (timeSec: number) => void) => () => void;
}) {
  const {
    isPlaying,
    isReady,
    getDisplayPlayheadTimeSec,
    formatMediaTime,
    durationSec,
    currentTimeSec = 0,
    timelineWidthPx = 0,
    onPlayheadMove,
    subscribePlayheadFrame,
  } = args;
  const [displayTimeSec, setDisplayTimeSec] = useState(0);
  const getDisplayPlayheadTimeSecRef = useRef(getDisplayPlayheadTimeSec);
  const onPlayheadMoveRef = useRef(onPlayheadMove);
  getDisplayPlayheadTimeSecRef.current = getDisplayPlayheadTimeSec;
  onPlayheadMoveRef.current = onPlayheadMove;

  const applyDisplayTime = (t: number, forceUi: boolean) => {
    const leftPct =
      timelineWidthPx > 0
        ? playheadTimelineLeftPct(t, timelineWidthPx, durationSec)
        : Math.max(-1, Math.min(101, (t / Math.max(durationSec, 1e-6)) * 100));
    onPlayheadMoveRef.current?.(t, leftPct);
    if (forceUi) {
      setDisplayTimeSec(t);
    }
  };

  useEffect(() => {
    if (!isReady) {
      setDisplayTimeSec(0);
      return;
    }
    if (isPlaying && subscribePlayheadFrame) {
      let lastUiCommitMs = 0;
      return subscribePlayheadFrame((timeSec) => {
        const now = performance.now();
        if (now - lastUiCommitMs >= 250) {
          lastUiCommitMs = now;
          setDisplayTimeSec(timeSec);
        }
        const leftPct =
          timelineWidthPx > 0
            ? playheadTimelineLeftPct(timeSec, timelineWidthPx, durationSec)
            : Math.max(-1, Math.min(101, (timeSec / Math.max(durationSec, 1e-6)) * 100));
        onPlayheadMoveRef.current?.(timeSec, leftPct);
      });
    }
    applyDisplayTime(getDisplayPlayheadTimeSecRef.current(), true);
  }, [
    currentTimeSec,
    durationSec,
    getDisplayPlayheadTimeSec,
    isPlaying,
    isReady,
    subscribePlayheadFrame,
    timelineWidthPx,
  ]);

  return {
    displayTimeSec,
    displayTimeLabel: formatMediaTime(displayTimeSec),
    durationLabel: formatMediaTime(durationSec),
  };
}
