import { getTranscriptEditorView } from "../components/editor/core/transcriptEditorViewHandle";
import { readTranscriptEditorCoreEnabled } from "../components/editor/core/transcriptEditorCoreFlag";
import { readTranscriptEditorSelectionText } from "../components/editor/core/textEditCommands";

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

function readLiveCm6Selection(): string {
  if (!readTranscriptEditorCoreEnabled()) return "";
  const view = getTranscriptEditorView();
  if (!view) return "";
  return readTranscriptEditorSelectionText(view);
}

/** 打开自定义语段菜单前释放正文焦点，避免 WebKit/Tauri 把首击派给其它行的 textarea。 */
export function blurActiveTranscriptTextarea(): void {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (isTranscriptTextarea(active)) {
    active.blur();
  }
}

/** 菜单打开期间禁用全部正文 textarea 命中，防止 Tauri/WebKit 把左击派给列表下的 textarea。 */
export function suspendTranscriptTextareasForContextMenu(): () => void {
  if (typeof document === "undefined") return () => {};
  blurActiveTranscriptTextarea();
  const touched: HTMLTextAreaElement[] = [];
  for (const el of document.querySelectorAll<HTMLTextAreaElement>(TRANSCRIPT_TEXTAREA_SELECTOR)) {
    if (!el.classList.contains("pointer-events-none")) {
      el.classList.add("pointer-events-none");
      touched.push(el);
    }
  }
  return () => {
    for (const el of touched) {
      el.classList.remove("pointer-events-none");
    }
  };
}

function readLiveTranscriptSelection(): string {
  if (typeof document === "undefined") return "";
  const cm6 = readLiveCm6Selection();
  if (cm6) return cm6;
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

/** Read selected text from the focused transcript textarea / CM6 core, if any. */
export function readTranscriptTextareaSelection(): string {
  const live = readLiveTranscriptSelection();
  if (live) return live;
  const cached = lastNonEmptySelection;
  if (cached && Date.now() - cached.updatedAt < 5_000) return cached.text;
  return "";
}
