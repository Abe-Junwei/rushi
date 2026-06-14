/** Max wait for peaks bootstrap before falling back to decode mount (long-audio safety). */
export const WAVEFORM_MOUNT_DEFER_TIMEOUT_MS = 90_000;

/** Shorter defer for long media — decode + Rust peaks run in parallel. */
const WAVEFORM_MOUNT_DEFER_SHORT_TIMEOUT_MS = 15_000;

/** Above this duration, skip peaks-first defer entirely. */
const WAVEFORM_MOUNT_DEFER_LONG_MEDIA_SEC = 30 * 60;

export function resolveWaveformMountDeferTimeoutMs(mediaDurationSec: number): number {
  if (mediaDurationSec > WAVEFORM_MOUNT_DEFER_LONG_MEDIA_SEC) {
    return WAVEFORM_MOUNT_DEFER_SHORT_TIMEOUT_MS;
  }
  return WAVEFORM_MOUNT_DEFER_TIMEOUT_MS;
}

/** Defer WaveSurfer mount until peaks bootstrap is ready when background peaks are on. */
export function resolveWaveformMountDeferred(input: {
  backgroundPeaksEnabled: boolean;
  peaksLoading: boolean;
  peakCache: unknown;
  peaksUnavailable: boolean;
  deferTimedOut?: boolean;
  mediaDurationSec?: number;
}): boolean {
  if (input.deferTimedOut) return false;
  if ((input.mediaDurationSec ?? 0) > WAVEFORM_MOUNT_DEFER_LONG_MEDIA_SEC) {
    return false;
  }
  return (
    input.backgroundPeaksEnabled &&
    input.peaksLoading &&
    !input.peakCache &&
    !input.peaksUnavailable
  );
}
