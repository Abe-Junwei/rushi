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
