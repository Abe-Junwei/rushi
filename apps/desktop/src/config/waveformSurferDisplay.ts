/** WaveSurfer v7 bar renderer — aligned with stitch peaks-bars (2px col, 1px gap, 2px radius). */
export const WAVEFORM_SURFER_BAR_DISPLAY = {
  barWidth: 2,
  barGap: 1,
  barRadius: 2,
  /** Vertical inset (~12%) so bars sit centered like stitch `.peaks-bars` padding. */
  barHeight: 0.88,
} as const;
