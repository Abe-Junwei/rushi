/**
 * Transcript playback-follow (Playback Focus) — pure policy helpers.
 * Selection / seek are intentionally out of scope (see transcript-playback-follow-research).
 */

export type TranscriptPlaybackRevealInput = {
  enabled: boolean;
  isPlaying: boolean;
  focusIdx: number;
  prevFocusIdx: number;
  /** CM6 editor has DOM focus (user editing). */
  editorFocused: boolean;
  /** performance.now() < until → user recently scrolled transcript. */
  userScrollSuppressUntilMs: number;
  nowMs: number;
  /** User selected a segment other than playback focus while playing. */
  selectionDiverted: boolean;
};

/** Whether to call revealSegmentInScrollDOM for the new focus line. */
export function shouldRevealTranscriptPlaybackFocus(
  input: TranscriptPlaybackRevealInput,
): boolean {
  if (!input.enabled || !input.isPlaying) return false;
  if (input.focusIdx < 0) return false;
  // Playback start sets focus from "none" to the current line. Skip center-scroll on
  // that first frame so starting play only paints focus chrome; subsequent segment
  // changes still reveal via revealSegmentInScrollDOM.
  if (input.prevFocusIdx < 0) return false;
  if (input.focusIdx === input.prevFocusIdx) return false;
  // Otter/Descript: playhead auto-scroll continues even when the editor has focus;
  // only user diversion / manual scroll suppresses. (editorFocused kept for callers/tests.)
  void input.editorFocused;
  if (input.nowMs < input.userScrollSuppressUntilMs) return false;
  if (input.selectionDiverted) return false;
  return true;
}

/** Clear diversion once selection re-aligns with playback focus (or playback stops). */
export function shouldClearPlaybackSelectionDivert(input: {
  isPlaying: boolean;
  selectionDiverted: boolean;
  primaryIdx: number;
  focusIdx: number;
}): boolean {
  if (!input.selectionDiverted) return false;
  if (!input.isPlaying) return true;
  return input.primaryIdx >= 0 && input.primaryIdx === input.focusIdx;
}

/** Mark diversion when user selects away from the current playback focus line. */
export function shouldMarkPlaybackSelectionDivert(input: {
  isPlaying: boolean;
  selectedIdx: number;
  focusIdx: number;
}): boolean {
  if (!input.isPlaying) return false;
  if (input.selectedIdx < 0 || input.focusIdx < 0) return false;
  return input.selectedIdx !== input.focusIdx;
}
