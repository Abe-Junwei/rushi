import type WaveSurfer from "wavesurfer.js";

type WaveSurferTimer = {
  start: () => void;
  stop: () => void;
};

type WaveSurferClockInternals = {
  timer?: WaveSurferTimer;
  updateProgress?: (timeSec?: number) => number;
};

type WaveSurferRendererProgress = {
  renderProgress?: (ratio: number, isPlaying: boolean) => void;
};

const silencedWaveSurfers = new WeakSet<object>();

/**
 * Stop WaveSurfer's internal rAF timer and noop progress paints.
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
    const timer = internal.timer;
    if (timer) {
      try {
        timer.stop();
      } catch {
        /* noop */
      }
      timer.start = () => {};
    }
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
