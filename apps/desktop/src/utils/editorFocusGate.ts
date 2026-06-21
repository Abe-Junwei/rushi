import { readFocusedSegmentTextareaIdx } from "../pages/flushSegmentTextDrafts";

export function isWaveformShellFocused(waveformShell: HTMLElement | null): boolean {
  if (typeof document === "undefined" || !waveformShell) return false;
  const active = document.activeElement;
  if (!(active instanceof Node)) return false;
  return waveformShell.contains(active);
}

/** Editor focus gate (F3): textarea or waveform shell holds focus. */
export function isEditorFocusGateOpen(input: {
  segmentsLength: number;
  waveformShell: HTMLElement | null;
}): boolean {
  if (readFocusedSegmentTextareaIdx(input.segmentsLength) != null) return true;
  return isWaveformShellFocused(input.waveformShell);
}
