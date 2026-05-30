import { WAVEFORM_EMBEDDED_TIME_RULER_H_PX } from "../components/WaveformTimeRuler";

/** Waveform drawable band height — tier total minus embedded ruler overlay band. */
export function waveformPeaksBandHeightPx(totalHeightPx: number): number {
  return Math.max(1, totalHeightPx - WAVEFORM_EMBEDDED_TIME_RULER_H_PX);
}

export { WAVEFORM_EMBEDDED_TIME_RULER_H_PX as WAVEFORM_RULER_BAND_HEIGHT_PX };
