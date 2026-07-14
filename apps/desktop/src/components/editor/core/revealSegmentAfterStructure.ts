import type { EditorView } from "@codemirror/view";
import {
  cancelScheduledReveal,
  revealSegmentInScrollDOM,
  scheduleRevealSegment,
} from "./revealSegment";

/**
 * Capture how far the segment line sits below the current scrollTop (before a
 * structure replace). Pass back into {@link revealSegmentAfterStructureChange}.
 */
export function readSegmentViewportAnchorOffsetPx(
  view: EditorView,
  segmentIdx: number,
): number | undefined {
  if (segmentIdx < 0 || segmentIdx >= view.state.doc.lines) return undefined;
  const line = view.state.doc.line(segmentIdx + 1);
  const block = view.lineBlockAt(line.from);
  return block.top - view.scrollDOM.scrollTop;
}

/**
 * Keep a segment line on-screen after merge/split/delete.
 *
 * Full-doc replace and React `segments` → `view.setState` wipe CM scroll while
 * selection/projection (waveform highlight) stay on the merged line — text
 * leaves the viewport. Prefer preserving the prior viewport offset; fall back
 * to pinning the line start when the line would otherwise stay off-screen.
 */
export function revealSegmentPreservingViewportOffset(
  view: EditorView,
  primaryIdx: number,
  opts?: { priorAnchorOffsetPx?: number },
): boolean {
  if (primaryIdx < 0 || primaryIdx >= view.state.doc.lines) return false;
  const scroller = view.scrollDOM;
  const line = view.state.doc.line(primaryIdx + 1);
  const block = view.lineBlockAt(line.from);
  const viewportH = Math.max(1, scroller.clientHeight);
  const maxTop = Math.max(0, scroller.scrollHeight - viewportH);

  if (opts?.priorAnchorOffsetPx == null || !Number.isFinite(opts.priorAnchorOffsetPx)) {
    return revealSegmentInScrollDOM(view, primaryIdx, { y: "nearest" });
  }

  // Keep the line where it was in the viewport when possible.
  let nextTop = block.top - opts.priorAnchorOffsetPx;

  // Oversized wrapped merge: always keep the line start visible (never snap to bottom).
  if (block.height > viewportH) {
    nextTop = Math.min(nextTop, block.top);
  }

  // If start would sit below the viewport, pin to start.
  if (block.top > nextTop + viewportH - 1) {
    nextTop = block.top;
  }
  // If start would sit above the viewport, pin to start.
  if (block.top < nextTop) {
    nextTop = block.top;
  }

  scroller.scrollTop = Math.round(Math.min(maxTop, Math.max(0, nextTop)));
  return true;
}

/**
 * Reveal now + after wrap/layout settles (CM lineWrapping).
 * Uses the shared cancellable scheduler — later reveals cancel earlier ones.
 */
export function revealSegmentAfterStructureChange(
  view: EditorView,
  primaryIdx: number,
  opts?: { priorAnchorOffsetPx?: number },
): void {
  scheduleRevealSegment(view, primaryIdx, {
    preserveAnchor: true,
    priorAnchorOffsetPx: opts?.priorAnchorOffsetPx,
    validateTarget: true,
    deferLayout: true,
  });
}

export { cancelScheduledReveal };
