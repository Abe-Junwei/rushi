import { useCallback, useEffect, useRef } from "react";
import { resolveDisplayPlayheadTimeSec } from "../utils/waveformDisplayPlayhead";
import {
  schedulePlaybackViewportFrame,
  subscribePlaybackFrame,
} from "../utils/tierScrollFrameCoordinator";
import {
  isWaveformScrollProfileEnabled,
  waveformScrollProfileAudioProcess,
} from "../services/waveform/waveformScrollProfile";

/** Lower priority runs first within a frame (scroll-follow before playhead transform). */
export type PlayheadFramePriority = number;

export const PLAYHEAD_FRAME_PRIORITY_SCROLL = 0;
export const PLAYHEAD_FRAME_PRIORITY_PLAYHEAD = 1;

/**
 * Single-source playhead clock — engine TimeUpdate/Seeked is the authority.
 *
 * While playing, a local rAF loop polls {@link getRawMediaPlayheadTimeSec}.
 * For native transport that getter may return a *display-only* interpolation
 * between authoritative Channel anchors (last event + wall-clock × rate).
 * Rules (ADR-0008 clock contract):
 * 1. Every TimeUpdate/Seeked re-anchors; interpolation only fills event gaps.
 * 2. Monotonic clamp: discard display values that jump backwards.
 * 3. Interpolated values must never feed seek/pause authority.
 * 4. Pause/seek latches immediately to the authoritative value.
 * {@link schedulePlaybackViewportFrame} merges playback UI with tier scroll chrome.
 */
export function useWaveformVisualPlayheadClock(input: {
  isPlaying: boolean;
  isReady: boolean;
  durationSec: number;
  currentTimeSec: number;
  /** Not used for visual lead; kept for parent hook input parity. */
  playbackRate: number;
  getRawMediaPlayheadTimeSec: () => number;
  /**
   * Live media playing flag (e.g. `ws.isPlaying()`). Prefer over React `isPlaying`
   * so the rAF loop stops the same stack as pause, without waiting for setState.
   */
  getRawMediaIsPlaying?: () => boolean;
}) {
  const argsRef = useRef(input);
  argsRef.current = input;

  const visualTimeSecRef = useRef(input.currentTimeSec);
  const lastAudioprocessAtMsRef = useRef<number | null>(null);
  const pausedImperativeSeekUntilRef = useRef(0);
  const pausedImperativeSeekTimeRef = useRef(0);

  const syncPausedTime = useCallback((timeSec: number) => {
    visualTimeSecRef.current = timeSec;
  }, []);

  const getVisualPlayheadTimeSec = useCallback(() => visualTimeSecRef.current, []);

  const getDisplayPlayheadTimeSec = useCallback(
    () =>
      resolveDisplayPlayheadTimeSec({
        isReady: argsRef.current.isReady,
        getVisualPlayheadTimeSec: () => visualTimeSecRef.current,
        getRawMediaPlayheadTimeSec: argsRef.current.getRawMediaPlayheadTimeSec,
      }),
    [],
  );

  const subscribePlayheadFrame = useCallback(
    (cb: (timeSec: number) => void, priority: PlayheadFramePriority = PLAYHEAD_FRAME_PRIORITY_PLAYHEAD) => {
      return subscribePlaybackFrame(cb, priority);
    },
    [],
  );

  const applyMediaTimeToVisualClock = useCallback((timeSec: number, scheduleFrame: boolean) => {
    const live = argsRef.current;
    if (!live.isReady) return;
    const dur = live.durationSec;
    const clamped =
      dur > 0 ? Math.max(0, Math.min(timeSec, dur)) : Math.max(0, timeSec);
    visualTimeSecRef.current = clamped;
    if (scheduleFrame) {
      schedulePlaybackViewportFrame(clamped);
    }
  }, []);

  useEffect(() => {
    const a = argsRef.current;
    if (!a.isReady) {
      syncPausedTime(0);
      return;
    }
    if (a.isPlaying) return;
    lastAudioprocessAtMsRef.current = null;
    const now = performance.now();
    if (now < pausedImperativeSeekUntilRef.current) {
      if (Math.abs(a.currentTimeSec - pausedImperativeSeekTimeRef.current) > 0.02) {
        return;
      }
      pausedImperativeSeekUntilRef.current = 0;
    }
    // While playing, React currentTime often stays at the last seek. After pause it
    // can briefly (or until commit) lag the frozen visual — never pull playhead back.
    if (a.currentTimeSec < visualTimeSecRef.current - 0.02) {
      return;
    }
    syncPausedTime(a.currentTimeSec);
  }, [input.currentTimeSec, input.isPlaying, input.isReady, syncPausedTime]);

  // Playing: poll media each animation frame (Peaks / WS-Timer isomorphic).
  useEffect(() => {
    if (!input.isPlaying || !input.isReady) return;
    let rafId = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const live = argsRef.current;
      // Stop on live media pause before React commits isPlaying=false (avoids +1 frame drift).
      const mediaPlaying = live.getRawMediaIsPlaying?.() ?? true;
      if (!mediaPlaying) {
        applyMediaTimeToVisualClock(live.getRawMediaPlayheadTimeSec(), true);
        stopped = true;
        return;
      }
      applyMediaTimeToVisualClock(live.getRawMediaPlayheadTimeSec(), true);
      rafId = requestAnimationFrame(tick);
    };
    // Same-stack first sample so playhead does not wait one blank frame after play().
    applyMediaTimeToVisualClock(argsRef.current.getRawMediaPlayheadTimeSec(), true);
    rafId = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
    };
  }, [applyMediaTimeToVisualClock, input.isPlaying, input.isReady]);

  const onWsAudioprocess = useCallback(
    (timeSec: number) => {
      const live = argsRef.current;
      if (!live.isReady) return;
      const profileEnabled = isWaveformScrollProfileEnabled();
      const startedAtMs = profileEnabled ? performance.now() : 0;
      const lastAtMs = profileEnabled ? lastAudioprocessAtMsRef.current : null;
      if (profileEnabled) {
        lastAudioprocessAtMsRef.current = startedAtMs;
      }
      // Playing: rAF loop owns schedulePlaybackViewportFrame. Audioprocess only anchors ref
      // (and covers the gap before React commits isPlaying=true).
      const scheduleFrame = !live.isPlaying;
      applyMediaTimeToVisualClock(timeSec, scheduleFrame);
      if (profileEnabled) {
        waveformScrollProfileAudioProcess({
          deltaMs: lastAtMs == null ? null : startedAtMs - lastAtMs,
          handlerMs: performance.now() - startedAtMs,
        });
      }
    },
    [applyMediaTimeToVisualClock],
  );

  const syncDisplayPlayheadAfterSeek = useCallback(
    (timeSec: number) => {
      if (!argsRef.current.isReady) return;
      if (argsRef.current.isPlaying) {
        visualTimeSecRef.current = timeSec;
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
