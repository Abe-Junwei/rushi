import { TRANSCRIPT_TEXTAREA_SELECTOR } from "../pages/flushSegmentTextDrafts";
import { isTranscriptEditorCoreTarget } from "../components/editor/core/transcriptEditorDom";

function isTranscriptTextEditNode(node: Node | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (node.closest(TRANSCRIPT_TEXTAREA_SELECTOR)) return true;
  return isTranscriptEditorCoreTarget(node);
}

/** waveform scope 快捷键：shell 焦点，或 tier 滚动区内且不在正文编辑（textarea/CM6）。 */
export function isWaveformShortcutContext(
  target: EventTarget | null,
  shell: HTMLElement | null,
  tierScroll: HTMLElement | null,
): boolean {
  const candidates = [target, document.activeElement].filter(Boolean) as Node[];
  for (const node of candidates) {
    if (shell?.contains(node)) return true;
    if (tierScroll?.contains(node) && !isTranscriptTextEditNode(node)) return true;
  }
  return false;
}
