import { EditorView } from "@codemirror/view";
import type { EditorState, TransactionSpec } from "@codemirror/state";

/**
 * Scroll a segment line into the CM6 viewport (replaces legacy list virtual reveal).
 */
export function revealSegmentTransaction(
  state: EditorState,
  segmentIdx: number,
  opts: { y?: "nearest" | "start" | "end" | "center" } = {},
): TransactionSpec | null {
  if (segmentIdx < 0 || segmentIdx >= state.doc.lines) return null;
  const line = state.doc.line(segmentIdx + 1);
  return {
    effects: EditorView.scrollIntoView(line.from, { y: opts.y ?? "nearest" }),
  };
}

export function revealSegmentInView(
  view: { state: EditorState; dispatch: (tr: TransactionSpec) => void },
  segmentIdx: number,
  opts?: { y?: "nearest" | "start" | "end" | "center" },
): boolean {
  const tr = revealSegmentTransaction(view.state, segmentIdx, opts);
  if (!tr) return false;
  view.dispatch(tr);
  return true;
}
