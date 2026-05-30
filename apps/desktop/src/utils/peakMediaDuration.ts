/** Peaks `.dat` duration vs WaveSurfer / HTML media duration alignment. */

export const PEAKS_MEDIA_MIN_COVERAGE_RATIO = 0.98;

/** Skip expensive force-regenerate on long media when the gap is likely container over-reporting. */
export const PEAKS_FORCE_REGENERATE_LONG_MEDIA_SEC = 3600;

export const PEAKS_FORCE_REGENERATE_LONG_MEDIA_MIN_RATIO = 0.95;

/** True when cached peaks cover less than ~98% of known media duration. */
export function peaksMediaDurationMismatch(
  peakDurationSec: number,
  mediaDurationSec: number,
): boolean {
  if (!(peakDurationSec > 0 && mediaDurationSec > 0)) return false;
  return peakDurationSec / mediaDurationSec < PEAKS_MEDIA_MIN_COVERAGE_RATIO;
}

/**
 * Whether to `force: true` regenerate peaks after a duration mismatch.
 * VBR containers often over-report; avoid a second full decode on 4h files when peaks already cover ≥95%.
 */
export function shouldForcePeaksRegenerate(
  peakDurationSec: number,
  mediaDurationSec: number,
): boolean {
  if (!peaksMediaDurationMismatch(peakDurationSec, mediaDurationSec)) return false;
  const ratio = peakDurationSec / mediaDurationSec;
  if (
    mediaDurationSec >= PEAKS_FORCE_REGENERATE_LONG_MEDIA_SEC &&
    ratio >= PEAKS_FORCE_REGENERATE_LONG_MEDIA_MIN_RATIO
  ) {
    return false;
  }
  return true;
}

/** Duration passed to peaks ensure / stale checks once media is known. */
export function peaksEnsureMediaDurationSec(mediaDurationSec: number): number | undefined {
  return mediaDurationSec > 0 ? mediaDurationSec : undefined;
}
