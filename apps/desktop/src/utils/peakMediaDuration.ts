/** Peaks `.dat` duration vs WaveSurfer / HTML media duration alignment. */

export const PEAKS_MEDIA_MIN_COVERAGE_RATIO = 0.98;

/** True when cached peaks cover less than ~98% of known media duration. */
export function peaksMediaDurationMismatch(
  peakDurationSec: number,
  mediaDurationSec: number,
): boolean {
  if (!(peakDurationSec > 0 && mediaDurationSec > 0)) return false;
  return peakDurationSec / mediaDurationSec < PEAKS_MEDIA_MIN_COVERAGE_RATIO;
}

/** Duration passed to peaks ensure / stale checks once media is known. */
export function peaksEnsureMediaDurationSec(mediaDurationSec: number): number | undefined {
  return mediaDurationSec > 0 ? mediaDurationSec : undefined;
}

export type ResolvePeaksDrawMediaDurationInput = {
  peakDurationSec: number;
  /** Layout / WS timeline duration (segments, scroll width). */
  layoutMediaDurationSec: number;
  /** Regenerating peaks after duration became known — keep drawing stale cache. */
  peaksLoading: boolean;
};

/**
 * Media duration passed into peaks resample + `drawWaveformPeaksTile`.
 * While peaks are reloading, use peak file duration so coverage checks pass and
 * existing columns map across the (possibly wider) layout without throwing.
 */
export function resolvePeaksDrawMediaDurationSec(
  input: ResolvePeaksDrawMediaDurationInput,
): number {
  const { peakDurationSec, layoutMediaDurationSec, peaksLoading } = input;
  if (peakDurationSec > 0 && layoutMediaDurationSec <= 0) {
    return peakDurationSec;
  }
  if (layoutMediaDurationSec <= 0) {
    return 0;
  }
  if (
    peaksLoading &&
    peaksMediaDurationMismatch(peakDurationSec, layoutMediaDurationSec)
  ) {
    return peakDurationSec;
  }
  return layoutMediaDurationSec;
}

export type WaveformPeaksUiState = "idle" | "loading" | "ready" | "error";

export function resolveWaveformPeaksUiState(input: {
  peakCache: unknown;
  peaksLoading: boolean;
  peaksError: string | null;
  layoutMediaDurationSec: number;
  peakDurationSec: number;
}): WaveformPeaksUiState {
  if (input.peaksError) return "error";
  if (input.peaksLoading) return "loading";
  if (!input.peakCache) return "idle";
  if (
    input.layoutMediaDurationSec > 0 &&
    input.peakDurationSec > 0 &&
    peaksMediaDurationMismatch(input.peakDurationSec, input.layoutMediaDurationSec)
  ) {
    return "error";
  }
  return "ready";
}

export function waveformPeaksStatusMessage(state: WaveformPeaksUiState, peaksError: string | null): string | null {
  if (peaksError) return peaksError;
  if (state === "loading") return "正在更新波形…";
  if (state === "idle") return "正在加载波形…";
  if (state === "error") return "波形数据与音频时长不一致";
  return null;
}
