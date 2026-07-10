import type { EditorState } from "@codemirror/state";
import {
  decodeDocLineToSegmentText,
  encodeSegmentTextForDocLine,
} from "./segmentNewlineCodec";

/**
 * Map a SegmentDto-text char range onto CM6 doc positions for that segment line.
 * Handles U+240A newline encoding (decoded offsets ≠ encoded when text has newlines).
 */
export function segmentCharRangeToDocRange(
  state: EditorState,
  segmentIdx: number,
  charStart: number,
  charEnd: number,
): { from: number; to: number } | null {
  if (segmentIdx < 0 || segmentIdx >= state.doc.lines) return null;
  const line = state.doc.line(segmentIdx + 1);
  const encoded = line.text;
  if (!encoded.includes("\u240A")) {
    const from = line.from + Math.max(0, Math.min(charStart, encoded.length));
    const to = line.from + Math.max(from - line.from, Math.min(charEnd, encoded.length));
    return { from, to };
  }
  const decoded = decodeDocLineToSegmentText(encoded);
  const start = Math.max(0, Math.min(charStart, decoded.length));
  const end = Math.max(start, Math.min(charEnd, decoded.length));
  const from = line.from + encodeSegmentTextForDocLine(decoded.slice(0, start)).length;
  const to = line.from + encodeSegmentTextForDocLine(decoded.slice(0, end)).length;
  return { from, to };
}
