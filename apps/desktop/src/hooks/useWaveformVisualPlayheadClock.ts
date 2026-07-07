import { useCallback, useEffect, useRef } from "react";
import { createVisualPlayheadClockState } from "../utils/visualPlayheadClock";
import { resolveDisplayPlayheadTimeSec } from "../utils/waveformDisplayPlayhead";
import {
  schedulePlaybackViewportFrame,
  subscribePlaybackFrame,
} from "../utils/tierScrollFrameCoordinator";

/** Lower priority runs first within a frame (scroll-follow before playhead transform). */
export type PlayheadFramePriority = number;

export const PLAYHEAD_FRAME_PRIORITY_SCROLL = 0;
export const PLAYHEAD_FRAME_PRIORITY_PLAYHEAD = 1;

/**
 * Visual playhead clock — WS `audioprocess` (rAF timer) is the media tick;
 * {@link schedulePlaybackViewportFrame} merges playback UI with tier scroll chrome in one rAF.
 */
export function useWaveformVisualPlayheadClock(input: {
  isPlaying: boolean;
  isReady: boolean;
  durationSec: number;
  currentTimeSec: number;
  playbackRate: number;
  getPlayheadTime: () => number;
}) {
  const argsRef = useRef(input);
  argsRef.current = input;

  const visualTimeSecRef = useRef(input.currentTimeSec);
  const clockStateRef = useRef(createVisualPlayheadClockState(input.currentTimeSec));
  const pausedImperativeSeekUntilRef = useRef(0);
  const pausedImperativeSeekTimeRef = useRef(0);

  const syncPausedTime = useCallback((timeSec: number) => {
    visualTimeSecRef.current = timeSec;
    clockStateRef.current = createVisualPlayheadClockState(timeSec);
  }, []);

  const getVisualPlayheadTimeSec = useCallback(() => visualTimeSecRef.current, []);

  const getDisplayPlayheadTimeSec = useCallback(
    () =>
      resolveDisplayPlayheadTimeSec({
        isPlaying: argsRef.current.isPlaying,
        isReady: argsRef.current.isReady,
        getVisualPlayheadTimeSec: () => visualTimeSecRef.current,
        getMediaPlayheadTimeSec: argsRef.current.getPlayheadTime,
      }),
    [],
  );

  const subscribePlayheadFrame = useCallback(
    (cb: (timeSec: number) => void, priority: PlayheadFramePriority = PLAYHEAD_FRAME_PRIORITY_PLAYHEAD) => {
      return subscribePlaybackFrame(cb, priority);
    },
    [],
  );

  useEffect(() => {
    const a = argsRef.current;
    if (!a.isReady) {
      syncPausedTime(0);
      return;
    }
    if (a.isPlaying) return;
    const now = performance.now();
    if (now < pausedImperativeSeekUntilRef.current) {
      if (Math.abs(a.currentTimeSec - pausedImperativeSeekTimeRef.current) > 0.02) {
        return;
      }
      pausedImperativeSeekUntilRef.current = 0;
    }
    syncPausedTime(a.currentTimeSec);
  }, [input.currentTimeSec, input.isPlaying, input.isReady, syncPausedTime]);

  const onWsAudioprocess = useCallback(
    (timeSec: number) => {
      const live = argsRef.current;
      if (!live.isReady) return;
      const dur = live.durationSec;
      const clamped =
        dur > 0 ? Math.max(0, Math.min(timeSec, dur)) : Math.max(0, timeSec);
      syncPausedTime(clamped);
      schedulePlaybackViewportFrame(clamped);
    },
    [syncPausedTime],
  );

  const syncDisplayPlayheadAfterSeek = useCallback(
    (timeSec: number) => {
      if (!argsRef.current.isReady) return;
      if (argsRef.current.isPlaying) {
        syncPausedTime(timeSec);
        schedulePlaybackViewportFrame(timeSec);
        return;
      }
      pausedImperativeSeekTimeRef.current = timeSec;
      pausedImperativeSeekUntilRef.current = performance.now() + 400;
      syncPausedTime(timeSec);
      schedulePlaybackViewportFrame(timeSec);
    },
    [syncPausedTime],
  );

  return {
    visualTimeSecRef,
    getVisualPlayheadTimeSec,
    getDisplayPlayheadTimeSec,
    subscribePlayheadFrame,
    syncDisplayPlayheadAfterSeek,
    onWsAudioprocess,
  };
}
