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
 * selection/projection stay on the merged line. Use the pre-replace anchor as a
 * same-primary signal, then place the line in the vertical middle of the
 * viewport (not the prior bottom-stuck offset, and not absolute doc jump).
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

  // Viewport-middle offset for the visible portion of the line.
  const centerOffsetPx = Math.max(0, (viewportH - Math.min(block.height, viewportH)) / 2);

  if (opts?.priorAnchorOffsetPx == null || !Number.isFinite(opts.priorAnchorOffsetPx)) {
    // No pre-replace anchor (primary changed): still prefer center over nearest
    // bottom-align, which sticks merged lines to the viewport edge.
    return revealSegmentInScrollDOM(view, primaryIdx, { y: "center" });
  }

  let nextTop = block.top - centerOffsetPx;

  // Oversized wrapped merge: keep the line start visible (cannot truly center).
  if (block.height > viewportH) {
    nextTop = block.top;
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
 * After merge/split/delete: wait for CM measure / one frame, then place the
 * primary line at viewport middle once. Sync scroll during lineWrapping settle
 * fights the heightmap ("Viewport failed to stabilize").
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
    waitForMeasure: true,
  });
}

export { cancelScheduledReveal };
