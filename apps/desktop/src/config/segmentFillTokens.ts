/**
 * 语段 fill 语义 — CSS 真源见 tokens.css `--segment-fill-*`。
 * Canvas（resolve）与 DOM overlay（var()）共用同一套变量名。
 */
export const SEGMENT_FILL_CSS_VAR = {
  selected: "--segment-fill-selected",
  selectedList: "--segment-fill-selected-list",
  inSelectionList: "--segment-fill-in-selection-list",
  inSelectionWaveform: "--segment-fill-in-selection-waveform",
  visited: "--segment-fill-visited",
  idle: "--segment-fill-idle",
  lowConfidence: "--segment-fill-low-confidence",
  border: "--segment-fill-border",
} as const;

export function segmentFillCssVar(name: keyof typeof SEGMENT_FILL_CSS_VAR): string {
  return `var(${SEGMENT_FILL_CSS_VAR[name]})`;
}
