import { WAVEFORM_EMBEDDED_RULER_HEIGHT_PX } from "../services/waveform/drawWaveformTimeRuler";

/** Waveform drawable band height — tier total minus embedded ruler overlay band. */
export function waveformPeaksBandHeightPx(totalHeightPx: number): number {
  return Math.max(1, totalHeightPx - WAVEFORM_EMBEDDED_RULER_HEIGHT_PX);
}
