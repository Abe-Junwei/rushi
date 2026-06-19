import { useCallback, useEffect, useRef } from "react";
import {
  createVisualPlayheadClockState,
  readVisualPlayheadTimeSec,
  type VisualPlayheadClockState,
} from "../utils/visualPlayheadClock";

/** Lower priority runs first within a frame (scroll-follow before playhead transform). */
export type PlayheadFramePriority = number;

export const PLAYHEAD_FRAME_PRIORITY_SCROLL = 0;
export const PLAYHEAD_FRAME_PRIORITY_PLAYHEAD = 1;

type PlayheadFrameSubscriber = {
  cb: (timeSec: number) => void;
  priority: PlayheadFramePriority;
};

/**
 * Single rAF visual clock + frame bus for all per-frame playback UI.
 *
 * The one tick advances the smoothed time, then notifies subscribers (scroll-follow,
 * playhead transform) in the SAME frame — removing the prior double-rAF lag where
 * the playhead read a one-frame-stale clock ref.
 */
export function useWaveformVisualPlayheadClock(input: {
  isPlaying: boolean;
  isReady: boolean;
  durationSec: number;
  currentTimeSec: number;
  playbackRate: number;
  getPlayheadTime: () => number;
}) {
  const {
    isPlaying,
    isReady,
    durationSec,
    currentTimeSec,
    playbackRate,
    getPlayheadTime,
  } = input;
  const argsRef = useRef(input);
  argsRef.current = input;

  const visualTimeSecRef = useRef(currentTimeSec);
  const clockStateRef = useRef<VisualPlayheadClockState>(
    createVisualPlayheadClockState(currentTimeSec),
  );
  const subscribersRef = useRef<Set<PlayheadFrameSubscriber>>(new Set());

  const syncPausedTime = useCallback((timeSec: number) => {
    visualTimeSecRef.current = timeSec;
    clockStateRef.current = createVisualPlayheadClockState(timeSec);
  }, []);

  const getVisualPlayheadTimeSec = useCallback(() => visualTimeSecRef.current, []);

  /** Subscribe to the single playback tick. Lower priority runs earlier in the frame. */
  const subscribePlayheadFrame = useCallback(
    (cb: (timeSec: number) => void, priority: PlayheadFramePriority = PLAYHEAD_FRAME_PRIORITY_PLAYHEAD) => {
      const entry: PlayheadFrameSubscriber = { cb, priority };
      subscribersRef.current.add(entry);
      return () => {
        subscribersRef.current.delete(entry);
      };
    },
    [],
  );

  const notifyPlayheadFrame = useCallback((timeSec: number) => {
    if (subscribersRef.current.size === 0) return;
    const ordered = [...subscribersRef.current].sort((a, b) => a.priority - b.priority);
    for (const sub of ordered) sub.cb(timeSec);
  }, []);

  useEffect(() => {
    const a = argsRef.current;
    if (!a.isReady) {
      syncPausedTime(0);
      return;
    }
    if (!a.isPlaying) {
      syncPausedTime(a.currentTimeSec);
      return;
    }

    syncPausedTime(a.getPlayheadTime());
    let rafId = 0;

    const tick = () => {
      const live = argsRef.current;
      if (!live.isReady || !live.isPlaying) return;
      const now = performance.now();
      visualTimeSecRef.current = readVisualPlayheadTimeSec({
        state: clockStateRef.current,
        nowMs: now,
        rawTimeSec: live.getPlayheadTime(),
        durationSec: live.durationSec,
        playbackRate: live.playbackRate,
      });
      notifyPlayheadFrame(visualTimeSecRef.current);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [currentTimeSec, durationSec, getPlayheadTime, isPlaying, isReady, notifyPlayheadFrame, playbackRate, syncPausedTime]);

  return {
    visualTimeSecRef,
    getVisualPlayheadTimeSec,
    subscribePlayheadFrame,
  };
}
