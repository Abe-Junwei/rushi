import { useEffect, useRef, useState } from "react";
import { playheadTimelineLeftPct } from "../utils/waveformProjection";

/** Ruler label clock: playing ticks via subscribePlayheadFrame; paused follows currentTimeSec. */
export function useWaveformLiveClock(args: {
  isPlaying: boolean;
  isReady: boolean;
  getPlayheadTime: () => number;
  formatMediaTime: (sec: number) => string;
  durationSec: number;
  /** WaveSurfer seeking/timeupdate — keeps label in sync while paused. */
  currentTimeSec?: number;
  /** When omitted, playhead pct falls back to time/duration (label-only consumers). */
  timelineWidthPx?: number;
  playbackRate?: number;
  onPlayheadMove?: (timeSec: number, leftPct: number) => void;
  subscribePlayheadFrame?: (cb: (timeSec: number) => void) => () => void;
  getVisualPlayheadTimeSec?: () => number;
}) {
  const {
    isPlaying,
    isReady,
    getPlayheadTime,
    formatMediaTime,
    durationSec,
    currentTimeSec = 0,
    timelineWidthPx = 0,
    onPlayheadMove,
    subscribePlayheadFrame,
    getVisualPlayheadTimeSec,
  } = args;
  const [displayTimeSec, setDisplayTimeSec] = useState(0);
  const getPlayheadTimeRef = useRef(getPlayheadTime);
  const onPlayheadMoveRef = useRef(onPlayheadMove);
  getPlayheadTimeRef.current = getPlayheadTime;
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
    const pausedTime = getVisualPlayheadTimeSec?.() ?? currentTimeSec;
    applyDisplayTime(pausedTime, true);
  }, [
    currentTimeSec,
    durationSec,
    getVisualPlayheadTimeSec,
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
