import type { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import type { SegmentDto } from "../../../tauri/projectTypes";
import {
  decodeDocLineToSegmentText,
  encodeSegmentTextForDocLine,
} from "./segmentNewlineCodec";
import { segmentCharRangeToDocRange } from "./segmentCharRangeToDoc";
import { selectSegmentCommand } from "./selectionCommands";
import { revealSegmentInView } from "./revealSegment";

/** Replace the full text of one segment line (decoded SegmentDto text). */
export function replaceSegmentLineTextCommand(
  view: EditorView,
  segmentIdx: number,
  nextText: string,
): boolean {
  if (segmentIdx < 0 || segmentIdx >= view.state.doc.lines) return false;
  const line = view.state.doc.line(segmentIdx + 1);
  const insert = encodeSegmentTextForDocLine(nextText);
  if (line.text === insert) return false;
  view.dispatch({
    changes: { from: line.from, to: line.to, insert },
  });
  return true;
}

/** Replace a decoded char range within one segment (find/replace once). */
export function replaceSegmentCharRangeCommand(
  view: EditorView,
  segmentIdx: number,
  charStart: number,
  findLen: number,
  replaceText: string,
): boolean {
  const range = segmentCharRangeToDocRange(
    view.state,
    segmentIdx,
    charStart,
    charStart + findLen,
  );
  if (!range) return false;
  const insert = encodeSegmentTextForDocLine(replaceText);
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
  });
  return true;
}

/** Apply many full-line text updates in one transaction (replace-all / correction rules). */
export function applySegmentTextsBulkCommand(
  view: EditorView,
  updates: ReadonlyArray<{ segmentIdx: number; text: string }>,
): boolean {
  if (updates.length === 0) return false;
  const changes = updates
    .filter((u) => u.segmentIdx >= 0 && u.segmentIdx < view.state.doc.lines)
    .map((u) => {
      const line = view.state.doc.line(u.segmentIdx + 1);
      return {
        from: line.from,
        to: line.to,
        insert: encodeSegmentTextForDocLine(u.text),
      };
    })
    .filter((c) => view.state.doc.sliceString(c.from, c.to) !== c.insert);
  if (changes.length === 0) return false;
  changes.sort((a, b) => b.from - a.from);
  view.dispatch({ changes });
  return true;
}

/** Focus a find match: select segment + scroll + optional caret on match. */
export function focusFindMatchCommand(
  view: EditorView,
  segmentIdx: number,
  charStart?: number,
  charEnd?: number,
): boolean {
  if (!selectSegmentCommand(view, segmentIdx)) return false;
  revealSegmentInView(view, segmentIdx, { y: "nearest" });
  if (charStart != null && charEnd != null && charEnd > charStart) {
    const range = segmentCharRangeToDocRange(view.state, segmentIdx, charStart, charEnd);
    if (range) {
      view.dispatch({
        selection: EditorSelection.range(range.from, range.to),
        scrollIntoView: true,
      });
    }
  }
  return true;
}

/** Read trimmed selected text from CM6 (decoded newlines). */
export function readTranscriptEditorSelectionText(view: EditorView): string {
  const { from, to } = view.state.selection.main;
  if (from === to) return "";
  const raw = view.state.doc.sliceString(from, to);
  return decodeDocLineToSegmentText(raw).trim();
}

/** Snapshot segments after a text-only CM6 edit (same length as baseline). */
export function projectTextsOntoBaseline(
  baseline: readonly SegmentDto[],
  view: EditorView,
): SegmentDto[] {
  const n = Math.min(baseline.length, view.state.doc.lines);
  return baseline.map((s, i) => {
    if (i >= n) return s;
    const line = view.state.doc.line(i + 1);
    return { ...s, text: decodeDocLineToSegmentText(line.text) };
  });
}
