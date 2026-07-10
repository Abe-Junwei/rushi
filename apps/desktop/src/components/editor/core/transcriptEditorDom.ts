/** DOM contract for Transcript Editor Core (CM6). */
export const TRANSCRIPT_EDITOR_CORE_ATTR = "data-transcript-editor-core";
export const TRANSCRIPT_EDITOR_CORE_SELECTOR = `.cm-editor[${TRANSCRIPT_EDITOR_CORE_ATTR}="1"]`;

export function isTranscriptEditorCoreTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  return Boolean(el.closest(TRANSCRIPT_EDITOR_CORE_SELECTOR));
}

/** True when focus is inside the CM6 transcript editor. */
export function isTranscriptEditorCoreFocused(): boolean {
  if (typeof document === "undefined") return false;
  return isTranscriptEditorCoreTarget(document.activeElement);
}
