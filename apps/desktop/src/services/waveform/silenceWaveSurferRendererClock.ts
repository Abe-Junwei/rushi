import type WaveSurfer from "wavesurfer.js";

type WaveSurferPlaybackClock = {
  start: (callback?: () => void) => void;
  stop: () => void;
};

type WaveSurferClockInternals = {
  /** v7 internal rAF owner. */
  timer?: WaveSurferPlaybackClock;
  /** v8 replacement for `timer` (`FrameScheduler`). */
  frameScheduler?: WaveSurferPlaybackClock;
  updateProgress?: (timeSec?: number) => number;
};

function silencePlaybackClock(clock: WaveSurferPlaybackClock | undefined): void {
  if (!clock) return;
  try {
    clock.stop();
  } catch {
    /* noop */
  }
  clock.start = () => {};
}

type WaveSurferRendererProgress = {
  renderProgress?: (ratio: number, isPlaying: boolean) => void;
};

const silencedWaveSurfers = new WeakSet<object>();

/**
 * Stop WaveSurfer's internal rAF clock and noop progress paints.
 * v7 exposes `timer`; v8 moved that loop to `frameScheduler`.
 * Rushi polls media.currentTime on its own rAF
 * ({@link useWaveformVisualPlayheadClock}); dual clocks + renderProgress
 * capped playbackFrames near ~40 after media-only canvas collapse.
 *
 * Idempotent per instance.
 */
export function silenceWaveSurferRendererClock(ws: WaveSurfer): boolean {
  if (silencedWaveSurfers.has(ws)) return false;
  const internal = ws as unknown as WaveSurferClockInternals;
  try {
    silencePlaybackClock(internal.timer);
    silencePlaybackClock(internal.frameScheduler);
    internal.updateProgress = (timeSec?: number) =>
      timeSec ?? (Number.isFinite(ws.getCurrentTime()) ? ws.getCurrentTime() : 0);
    const renderer = ws.getRenderer() as unknown as WaveSurferRendererProgress;
    if (renderer) {
      renderer.renderProgress = () => {};
    }
    silencedWaveSurfers.add(ws);
    return true;
  } catch {
    return false;
  }
}

/** Test-only: allow re-silencing the same mock instance. */
export function resetWaveSurferRendererClockSilenceForTests(ws?: WaveSurfer): void {
  if (ws) silencedWaveSurfers.delete(ws);
}
