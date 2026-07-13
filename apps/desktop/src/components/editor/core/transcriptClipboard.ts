import { EditorSelection, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  decodeDocLineToSegmentText,
  encodeSegmentTextForDocLine,
} from "./segmentNewlineCodec";

/**
 * Clipboard text ↔ one-line-per-segment doc.
 * Paste: real newlines become U+240A so line-count guard is not tripped.
 * Copy/cut: U+240A becomes real newlines for external apps.
 */
export const transcriptClipboardFilters: Extension[] = [
  EditorView.clipboardInputFilter.of((text) => encodeSegmentTextForDocLine(text)),
  EditorView.clipboardOutputFilter.of((text) => decodeDocLineToSegmentText(text)),
];

export function transcriptSelectionIsSingleLine(view: EditorView): boolean {
  const { from, to } = view.state.selection.main;
  if (from === to) return true;
  return view.state.doc.lineAt(from).number === view.state.doc.lineAt(to).number;
}

/** Selection text, or current line when caret is empty (never includes structural \\n). */
export function resolveTranscriptClipboardRange(view: EditorView): {
  from: number;
  to: number;
  text: string;
} | null {
  if (!transcriptSelectionIsSingleLine(view)) return null;
  const { from, to } = view.state.selection.main;
  if (from !== to) {
    return {
      from,
      to,
      text: decodeDocLineToSegmentText(view.state.doc.sliceString(from, to)),
    };
  }
  const line = view.state.doc.lineAt(from);
  return {
    from: line.from,
    to: line.to,
    text: decodeDocLineToSegmentText(line.text),
  };
}

export function readTranscriptClipboardSelectionText(view: EditorView): string {
  return resolveTranscriptClipboardRange(view)?.text ?? "";
}

export async function copyTranscriptSelection(view: EditorView): Promise<boolean> {
  const range = resolveTranscriptClipboardRange(view);
  if (!range || !range.text) return false;
  try {
    await navigator.clipboard.writeText(range.text);
  } catch {
    return false;
  }
  return true;
}

export async function cutTranscriptSelection(view: EditorView): Promise<boolean> {
  const range = resolveTranscriptClipboardRange(view);
  if (!range || !range.text) return false;
  try {
    await navigator.clipboard.writeText(range.text);
  } catch {
    return false;
  }
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: "" },
    selection: EditorSelection.cursor(range.from),
    userEvent: "delete.cut",
  });
  return true;
}

export async function pasteTranscriptClipboard(view: EditorView): Promise<boolean> {
  let raw = "";
  try {
    raw = await navigator.clipboard.readText();
  } catch {
    return false;
  }
  if (!transcriptSelectionIsSingleLine(view)) return false;
  const insert = encodeSegmentTextForDocLine(raw);
  const { from, to } = view.state.selection.main;
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.cursor(from + insert.length),
    userEvent: "input.paste",
  });
  return true;
}
