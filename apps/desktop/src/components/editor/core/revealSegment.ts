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

/**
 * Playback follow must only move CM6's internal scroller.
 *
 * `EditorView.scrollIntoView` delegates to browser scroll logic and can propagate
 * through the WKWebView ancestor chain, which visually pushes editor chrome
 * (header/footer) out of its flex viewport during playback.
 */
export function revealSegmentInScrollDOM(
  view: EditorView,
  segmentIdx: number,
  opts: { y?: "nearest" | "start" | "end" | "center" } = {},
): boolean {
  if (segmentIdx < 0 || segmentIdx >= view.state.doc.lines) return false;
  const line = view.state.doc.line(segmentIdx + 1);
  const block = view.lineBlockAt(line.from);
  const scroller = view.scrollDOM;
  const viewportTop = scroller.scrollTop;
  const viewportBottom = viewportTop + scroller.clientHeight;
  let nextTop = viewportTop;

  switch (opts.y ?? "nearest") {
    case "center":
      nextTop = block.top - Math.max(0, (scroller.clientHeight - block.height) / 2);
      break;
    case "start":
      nextTop = block.top;
      break;
    case "end":
      nextTop = block.bottom - scroller.clientHeight;
      break;
    case "nearest":
      if (block.top < viewportTop) {
        nextTop = block.top;
      } else if (block.bottom > viewportBottom) {
        nextTop = block.bottom - scroller.clientHeight;
      }
      break;
  }

  const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  scroller.scrollTop = Math.round(Math.min(maxTop, Math.max(0, nextTop)));
  return true;
}
