import { pickPeakLodLevel } from "../services/waveform/peakLevels";

/** Precomputed .dat LOD index (0=coarse … 3=fine) for a timeline px/s intent. */
export function resolvePeakLodLevelForPxPerSec(pxPerSec: number): number {
  if (!Number.isFinite(pxPerSec) || pxPerSec <= 0) return 0;
  return pickPeakLodLevel(pxPerSec);
}

/**
 * Mature zoom fallback: when peaks are already in WaveSurfer and the loaded LOD is
 * at least as fine as the intent needs, ws.zoom stretch is enough — skip ws.load.
 * (Peaks.js / WaveSurfer upsample path; audiowaveform resample returns base data when upsampling.)
 */
export function shouldZoomOnlyWithLoadedPeaksStretch(input: {
  intentPxPerSec: number;
  loadedPeaksPxPerSec: number;
  peaksLoadedIntoWaveSurfer: boolean;
}): boolean {
  const { intentPxPerSec, loadedPeaksPxPerSec, peaksLoadedIntoWaveSurfer } = input;
  if (!peaksLoadedIntoWaveSurfer) return false;
  if (!Number.isFinite(loadedPeaksPxPerSec) || loadedPeaksPxPerSec <= 0) return false;
  if (!Number.isFinite(intentPxPerSec) || intentPxPerSec <= 0) return false;
  const loadedLod = resolvePeakLodLevelForPxPerSec(loadedPeaksPxPerSec);
  const requestedLod = resolvePeakLodLevelForPxPerSec(intentPxPerSec);
  return loadedLod >= requestedLod;
}
