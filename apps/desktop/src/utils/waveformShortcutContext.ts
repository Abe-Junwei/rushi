import { TRANSCRIPT_TEXTAREA_SELECTOR } from "../pages/flushSegmentTextDrafts";

function isTranscriptTextareaNode(node: Node | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  return Boolean(node.closest(TRANSCRIPT_TEXTAREA_SELECTOR));
}

/** waveform scope 快捷键：shell 焦点，或 tier 滚动区内且不在正文 textarea。 */
export function isWaveformShortcutContext(
  target: EventTarget | null,
  shell: HTMLElement | null,
  tierScroll: HTMLElement | null,
): boolean {
  const candidates = [target, document.activeElement].filter(Boolean) as Node[];
  for (const node of candidates) {
    if (shell?.contains(node)) return true;
    if (tierScroll?.contains(node) && !isTranscriptTextareaNode(node)) return true;
  }
  return false;
}
