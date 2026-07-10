import { isTranscriptEditorCoreFocused } from "../components/editor/core/transcriptEditorDom";

export function isWaveformShellFocused(waveformShell: HTMLElement | null): boolean {
  if (typeof document === "undefined" || !waveformShell) return false;
  const active = document.activeElement;
  if (!(active instanceof Node)) return false;
  return waveformShell.contains(active);
}

/** Editor focus gate (F3): CM6 transcript core or waveform shell holds focus. */
export function isEditorFocusGateOpen(input: {
  segmentsLength: number;
  waveformShell: HTMLElement | null;
}): boolean {
  void input.segmentsLength;
  if (isTranscriptEditorCoreFocused()) return true;
  return isWaveformShellFocused(input.waveformShell);
}
