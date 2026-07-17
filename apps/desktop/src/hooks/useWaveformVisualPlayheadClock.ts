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
import { SEEK_SETTLE_WINDOW_MS } from "../utils/waveformSeekSettle";

/** Lower priority runs first within a frame (scroll-follow before playhead transform). */
export type PlayheadFramePriority = number;

export const PLAYHEAD_FRAME_PRIORITY_SCROLL = 0;
export const PLAYHEAD_FRAME_PRIORITY_PLAYHEAD = 1;

/** Zombie safety only — normal release is {@link endVisualSeek} after transport seeked ACK. */
const VISUAL_SEEK_ZOMBIE_MS = 2_000;
/**
 * After seeked ACK, reject backward engine display for this window. Shares the one
 * {@link SEEK_SETTLE_WINDOW_MS} (and seeked-ACK anchor) with native stale/settle
 * guards + follow-suppress so all release together. Edge mode maps time→x — a
 * lagging display yanks the needle.
 */
const SEEK_DISPLAY_GROUNDING_MS = SEEK_SETTLE_WINDOW_MS;
const SEEK_DISPLAY_GROUNDING_TOLERANCE_SEC = 0.03;

/**
 * Single-source playhead clock for UI — polls engine *display* time (ADR-0008).
 *
 * While playing, a local rAF loop polls {@link getEngineDisplayTimeSec}
 * (`getDisplayMediaPlayheadTimeSec` / native interpolator). Imperative seeks use
 * {@link beginVisualSeek} / {@link endVisualSeek} (event-driven, Peaks/Video.js
 * style). Pause freeze uses pin-only {@link syncDisplayPlayheadAfterSeek}.
 * Rules (ADR-0008 clock contract):
 * 1. Every TimeUpdate/Seeked re-anchors; interpolation only fills event gaps.
 * 2. Monotonic clamp: discard display values that jump backwards.
 * 3. Interpolated display must not be the sole seek-command authority.
 * 4. Pause latch = display high-water (`max(display, authority)`); never snap
 *    back to a lagging TimeUpdate alone.
 * {@link schedulePlaybackViewportFrame} merges playback UI with tier scroll chrome.
 */
export function useWaveformVisualPlayheadClock(input: {
  isPlaying: boolean;
  isReady: boolean;
  durationSec: number;
  currentTimeSec: number;
  /** Not used for visual lead; kept for parent hook input parity. */
  playbackRate: number;
  /** Engine display clock (native may interpolate). Not the authority latch. */
  getEngineDisplayTimeSec: () => number;
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
  const isVisualSeekingRef = useRef(false);
  const visualSeekPinnedTimeRef = useRef(0);
  const visualSeekBeganAtMsRef = useRef(0);
  const seekDisplayGroundingRef = useRef<{ targetSec: number; untilMs: number } | null>(null);

  const clampTimeSec = useCallback((timeSec: number) => {
    const dur = argsRef.current.durationSec;
    return dur > 0 ? Math.max(0, Math.min(timeSec, dur)) : Math.max(0, timeSec);
  }, []);

  const syncPausedTime = useCallback(
    (timeSec: number) => {
      visualTimeSecRef.current = clampTimeSec(timeSec);
    },
    [clampTimeSec],
  );

  const getVisualPlayheadTimeSec = useCallback(() => visualTimeSecRef.current, []);

  const getDisplayPlayheadTimeSec = useCallback(
    () =>
      resolveDisplayPlayheadTimeSec({
        isReady: argsRef.current.isReady,
        getVisualPlayheadTimeSec: () => visualTimeSecRef.current,
        getEngineDisplayTimeSec: argsRef.current.getEngineDisplayTimeSec,
      }),
    [],
  );

  const subscribePlayheadFrame = useCallback(
    (cb: (timeSec: number) => void, priority: PlayheadFramePriority = PLAYHEAD_FRAME_PRIORITY_PLAYHEAD) => {
      return subscribePlaybackFrame(cb, priority);
    },
    [],
  );

  const publishPinnedSeekTime = useCallback((scheduleFrame: boolean) => {
    const pinned = visualSeekPinnedTimeRef.current;
    visualTimeSecRef.current = pinned;
    if (scheduleFrame) {
      schedulePlaybackViewportFrame(pinned);
    }
  }, []);

  const applyMediaTimeToVisualClock = useCallback(
    (timeSec: number, scheduleFrame: boolean) => {
      const live = argsRef.current;
      if (!live.isReady) return;
      // VisualSeeking: UI owns the clock until transport seeked ACK (endVisualSeek).
      // Do not let lagging engine display yank the needle during the seek window.
      if (isVisualSeekingRef.current) {
        const now = performance.now();
        if (now - visualSeekBeganAtMsRef.current > VISUAL_SEEK_ZOMBIE_MS) {
          isVisualSeekingRef.current = false;
        } else {
          publishPinnedSeekTime(scheduleFrame);
          return;
        }
      }
      const clamped = clampTimeSec(timeSec);
      const grounding = seekDisplayGroundingRef.current;
      const now = performance.now();
      if (grounding && now < grounding.untilMs) {
        // Monotonic forward from seek target — never let a stale engine sample rewind.
        const grounded = Math.max(grounding.targetSec, clamped, visualTimeSecRef.current);
        visualTimeSecRef.current = grounded;
        if (Math.abs(clamped - grounding.targetSec) <= SEEK_DISPLAY_GROUNDING_TOLERANCE_SEC) {
          seekDisplayGroundingRef.current = null;
        }
      } else {
        seekDisplayGroundingRef.current = null;
        visualTimeSecRef.current = clamped;
      }
      if (scheduleFrame) {
        schedulePlaybackViewportFrame(visualTimeSecRef.current);
      }
    },
    [clampTimeSec, publishPinnedSeekTime],
  );

  useEffect(() => {
    const a = argsRef.current;
    if (!a.isReady) {
      syncPausedTime(0);
      return;
    }
    if (a.isPlaying) return;
    lastAudioprocessAtMsRef.current = null;
    // VisualSeeking owns the pin until endVisualSeek — do not let a stale React
    // currentTime commit overwrite the seek target while setTime is in flight.
    if (isVisualSeekingRef.current) return;
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
        applyMediaTimeToVisualClock(live.getEngineDisplayTimeSec(), true);
        stopped = true;
        return;
      }
      applyMediaTimeToVisualClock(live.getEngineDisplayTimeSec(), true);
      rafId = requestAnimationFrame(tick);
    };
    // Same-stack first sample so playhead does not wait one blank frame after play().
    applyMediaTimeToVisualClock(argsRef.current.getEngineDisplayTimeSec(), true);
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

  /** Pin visual playhead without entering VisualSeeking (pause / finish / segment-end). */
  const syncDisplayPlayheadAfterSeek = useCallback(
    (timeSec: number) => {
      if (!argsRef.current.isReady) return;
      const clamped = clampTimeSec(timeSec);
      syncPausedTime(clamped);
      schedulePlaybackViewportFrame(clamped);
    },
    [clampTimeSec, syncPausedTime],
  );

  /** Start VisualSeeking — blocks engine polls until {@link endVisualSeek}. */
  const beginVisualSeek = useCallback(
    (timeSec: number, opts?: { deferViewportFrame?: boolean }) => {
      if (!argsRef.current.isReady) return;
      const clamped = clampTimeSec(timeSec);
      isVisualSeekingRef.current = true;
      visualSeekPinnedTimeRef.current = clamped;
      visualSeekBeganAtMsRef.current = performance.now();
      syncPausedTime(clamped);
      if (!opts?.deferViewportFrame) {
        schedulePlaybackViewportFrame(clamped);
      }
    },
    [clampTimeSec, syncPausedTime],
  );

  /** Release VisualSeeking after transport seeked ACK; re-anchor to authority time. */
  const endVisualSeek = useCallback(
    (timeSec: number) => {
      if (!argsRef.current.isReady) return;
      isVisualSeekingRef.current = false;
      const clamped = clampTimeSec(timeSec);
      syncPausedTime(clamped);
      seekDisplayGroundingRef.current = {
        targetSec: clamped,
        untilMs: performance.now() + SEEK_DISPLAY_GROUNDING_MS,
      };
      schedulePlaybackViewportFrame(clamped);
    },
    [clampTimeSec, syncPausedTime],
  );

  return {
    visualTimeSecRef,
    getVisualPlayheadTimeSec,
    getDisplayPlayheadTimeSec,
    subscribePlayheadFrame,
    syncDisplayPlayheadAfterSeek,
    beginVisualSeek,
    endVisualSeek,
    onWsAudioprocess,
  };
}
