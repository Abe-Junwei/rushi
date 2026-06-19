import { useEffect, useRef, useState } from "react";
import { playheadTimelineLeftPct } from "../utils/waveformProjection";
import {
  createVisualPlayheadClockState,
  readVisualPlayheadTimeSec,
} from "../utils/visualPlayheadClock";

/** 播放中用 rAF 读 playhead；React 状态节流到 ~250ms，playhead 线可每帧直写 DOM。 */
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
}) {
  const {
    isPlaying,
    isReady,
    getPlayheadTime,
    formatMediaTime,
    durationSec,
    currentTimeSec = 0,
    timelineWidthPx = 0,
    playbackRate = 1,
    onPlayheadMove,
  } = args;
  const [displayTimeSec, setDisplayTimeSec] = useState(0);
  const getPlayheadTimeRef = useRef(getPlayheadTime);
  const onPlayheadMoveRef = useRef(onPlayheadMove);
  const playbackRateRef = useRef(playbackRate);
  getPlayheadTimeRef.current = getPlayheadTime;
  onPlayheadMoveRef.current = onPlayheadMove;
  playbackRateRef.current = playbackRate;

  useEffect(() => {
    if (!isReady) {
      setDisplayTimeSec(0);
      return;
    }

    let rafId = 0;
    let lastUiCommitMs = 0;

    const applyTime = (t: number, forceUi: boolean) => {
      const leftPct =
        timelineWidthPx > 0
          ? playheadTimelineLeftPct(t, timelineWidthPx, durationSec)
          : Math.max(-1, Math.min(101, (t / Math.max(durationSec, 1e-6)) * 100));
      onPlayheadMoveRef.current?.(t, leftPct);
      const now = performance.now();
      if (forceUi || now - lastUiCommitMs >= 250) {
        lastUiCommitMs = now;
        setDisplayTimeSec(t);
      }
    };

    if (!isPlaying) {
      applyTime(currentTimeSec, true);
      return;
    }

    // Single smoothing source of truth (shared with the playhead/scroll visual clock).
    const clockState = createVisualPlayheadClockState(getPlayheadTimeRef.current());
    const readVisualTime = () =>
      readVisualPlayheadTimeSec({
        state: clockState,
        nowMs: performance.now(),
        rawTimeSec: getPlayheadTimeRef.current(),
        durationSec,
        playbackRate: Number.isFinite(playbackRateRef.current) ? playbackRateRef.current : 1,
      });

    const tick = () => {
      applyTime(readVisualTime(), false);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [durationSec, isPlaying, isReady, timelineWidthPx, currentTimeSec, playbackRate]);

  return {
    displayTimeSec,
    displayTimeLabel: formatMediaTime(displayTimeSec),
    durationLabel: formatMediaTime(durationSec),
  };
}
