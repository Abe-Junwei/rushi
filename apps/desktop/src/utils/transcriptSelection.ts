const TRANSCRIPT_TEXTAREA_SELECTOR = 'textarea[aria-label="语段正文"]';

type SelectionCache = { text: string; updatedAt: number };

let lastNonEmptySelection: SelectionCache | null = null;

function sliceTextareaSelection(el: HTMLTextAreaElement): string {
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  if (start === end) return "";
  return el.value.slice(Math.min(start, end), Math.max(start, end)).trim();
}

function isTranscriptTextarea(el: unknown): el is HTMLTextAreaElement {
  return el instanceof HTMLTextAreaElement && el.getAttribute("aria-label") === "语段正文";
}

function readLiveTranscriptSelection(): string {
  if (typeof document === "undefined") return "";
  const active = document.activeElement;
  if (isTranscriptTextarea(active)) {
    const sel = sliceTextareaSelection(active);
    if (sel) return sel;
  }
  for (const el of document.querySelectorAll<HTMLTextAreaElement>(TRANSCRIPT_TEXTAREA_SELECTOR)) {
    const sel = sliceTextareaSelection(el);
    if (sel) return sel;
  }
  return "";
}

/** Call from transcript textarea onSelect / onMouseUp / onKeyUp to survive toolbar focus changes. */
export function syncTranscriptTextareaSelection(el: HTMLTextAreaElement): void {
  if (!isTranscriptTextarea(el)) return;
  const text = sliceTextareaSelection(el);
  if (text) {
    lastNonEmptySelection = { text, updatedAt: Date.now() };
    return;
  }
  lastNonEmptySelection = null;
}

/** Snapshot before toolbar buttons steal focus (pointerdown). */
export function captureTranscriptTextareaSelection(): string {
  const live = readLiveTranscriptSelection();
  if (live) {
    lastNonEmptySelection = { text: live, updatedAt: Date.now() };
    return live;
  }
  return lastNonEmptySelection?.text ?? "";
}

/** Read selected text from the focused transcript textarea, if any. */
export function readTranscriptTextareaSelection(): string {
  const live = readLiveTranscriptSelection();
  if (live) return live;
  const cached = lastNonEmptySelection;
  if (cached && Date.now() - cached.updatedAt < 5_000) return cached.text;
  return "";
}
