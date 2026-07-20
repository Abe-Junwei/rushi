import type { EditorState } from "@codemirror/state";
import {
  isTranscriptSegmentVisible,
  resolveNextVisibleSegmentIdx,
} from "./filterLineVisibility";

/**
 * Stable segment idx on meta/stage gutter marker DOM.
 * Survives CM6 filter-collapse hit-testing (lineBlockAtHeight → preceding
 * zero-height widget `from` = first hidden idx in the run).
 */
export const CM_SEGMENT_IDX_ATTR = "data-cm-segment-idx";

/**
 * Prefer idx stamped on marker DOM; otherwise coerce filter-hidden
 * `lineFrom` hits to the nearest visible segment.
 */
export function resolveTranscriptGutterSegmentIdx(
  state: EditorState,
  lineFrom: number,
  event: MouseEvent,
): number {
  const target = event.target as HTMLElement | null;
  const stamped = target?.closest(`[${CM_SEGMENT_IDX_ATTR}]`)?.getAttribute(CM_SEGMENT_IDX_ATTR);
  if (stamped != null) {
    const parsed = Number.parseInt(stamped, 10);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed < state.doc.lines) {
      return parsed;
    }
  }

  const idx = state.doc.lineAt(lineFrom).number - 1;
  if (idx < 0 || idx >= state.doc.lines) return idx;
  if (isTranscriptSegmentVisible(state, idx)) return idx;

  return (
    resolveNextVisibleSegmentIdx(state, idx - 1, 1) ??
    resolveNextVisibleSegmentIdx(state, idx + 1, -1) ??
    idx
  );
}
