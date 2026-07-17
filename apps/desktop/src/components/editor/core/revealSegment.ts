import { EditorView } from "@codemirror/view";
import type { EditorState, TransactionSpec } from "@codemirror/state";
import { primarySegmentIdx } from "./selectionField";
import { isTranscriptSegmentVisible } from "./filterLineVisibility";

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
  view: EditorView | { state: EditorState; dispatch: (tr: TransactionSpec) => void },
  segmentIdx: number,
  opts?: { y?: "nearest" | "start" | "end" | "center" },
): boolean {
  // Prefer DOM scroll. CM `scrollIntoView` mis-reads filter collapse height maps
  // (thousands of hidden lines) and jumps the list backward on click / ↑↓.
  if (view instanceof EditorView) {
    return revealSegmentInScrollDOM(view, segmentIdx, opts);
  }
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
      // Oversized line (common after multi-segment merge): scrolling so the
      // bottom sits on the viewport edge jumps the user to later wrapped text.
      if (block.height > scroller.clientHeight) {
        if (block.top < viewportTop) nextTop = block.top;
        break;
      }
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

function revealSegmentPreservingViewportOffsetInline(
  view: EditorView,
  primaryIdx: number,
  priorAnchorOffsetPx?: number,
): boolean {
  if (primaryIdx < 0 || primaryIdx >= view.state.doc.lines) return false;
  const scroller = view.scrollDOM;
  const line = view.state.doc.line(primaryIdx + 1);
  const block = view.lineBlockAt(line.from);
  const viewportH = Math.max(1, scroller.clientHeight);
  const maxTop = Math.max(0, scroller.scrollHeight - viewportH);

  if (priorAnchorOffsetPx == null || !Number.isFinite(priorAnchorOffsetPx)) {
    return revealSegmentInScrollDOM(view, primaryIdx, { y: "nearest" });
  }

  let nextTop = block.top - priorAnchorOffsetPx;
  if (block.height > viewportH) {
    nextTop = Math.min(nextTop, block.top);
  }
  if (block.top > nextTop + viewportH - 1) {
    nextTop = block.top;
  }
  if (block.top < nextTop) {
    nextTop = block.top;
  }

  scroller.scrollTop = Math.round(Math.min(maxTop, Math.max(0, nextTop)));
  return true;
}

type RevealScheduleState = {
  generation: number;
  cleanup: (() => void) | null;
};

const revealScheduleByView = new WeakMap<EditorView, RevealScheduleState>();

function getRevealSchedule(view: EditorView): RevealScheduleState {
  let state = revealScheduleByView.get(view);
  if (!state) {
    state = { generation: 0, cleanup: null };
    revealScheduleByView.set(view, state);
  }
  return state;
}

/** Cancel pending reveal tasks for a view (tests / unmount). */
export function cancelScheduledReveal(view: EditorView): void {
  const state = revealScheduleByView.get(view);
  if (!state) return;
  state.generation += 1;
  state.cleanup?.();
  state.cleanup = null;
}

export type ScheduleRevealSegmentOpts = {
  y?: "nearest" | "start" | "end" | "center";
  priorAnchorOffsetPx?: number;
  /** When set, apply preserving-offset reveal instead of nearest. */
  preserveAnchor?: boolean;
  /** Re-check primary + visibility before each run. */
  validateTarget?: boolean;
  /**
   * After layout settles, optionally re-reveal once.
   * Uses CM `requestMeasure` + a single rAF fallback (not a blind sync+2×rAF
   * triple scroll — that fights lineWrapping height settle after merge).
   */
  deferLayout?: boolean;
};

function readRevealLineGeom(
  view: EditorView,
  segmentIdx: number,
): { top: number; height: number } | null {
  if (segmentIdx < 0 || segmentIdx >= view.state.doc.lines) return null;
  const line = view.state.doc.line(segmentIdx + 1);
  const block = view.lineBlockAt(line.from);
  return { top: block.top, height: block.height };
}

/**
 * Single cancellable reveal chain. Later calls bump generation and cancel prior
 * sync + deferred settle work. Trusted wheel/pointer on scrollDOM aborts remaining runs.
 */
export function scheduleRevealSegment(
  view: EditorView,
  segmentIdx: number,
  opts: ScheduleRevealSegmentOpts = {},
): number {
  const state = getRevealSchedule(view);
  state.cleanup?.();
  state.cleanup = null;
  const generation = state.generation + 1;
  state.generation = generation;

  let userInterrupted = false;
  const markInterrupted = (ev: Event) => {
    if (ev.isTrusted) userInterrupted = true;
  };
  const scroller = view.scrollDOM;
  scroller.addEventListener("wheel", markInterrupted, { passive: true });
  scroller.addEventListener("pointerdown", markInterrupted, { passive: true });

  const cleanup = () => {
    scroller.removeEventListener("wheel", markInterrupted);
    scroller.removeEventListener("pointerdown", markInterrupted);
    if (revealScheduleByView.get(view)?.cleanup === cleanup) {
      state.cleanup = null;
    }
  };
  state.cleanup = cleanup;

  let lastGeom: { top: number; height: number } | null = null;

  const run = (mode: "force" | "ifChanged"): boolean => {
    if (getRevealSchedule(view).generation !== generation) return false;
    if (userInterrupted) {
      cleanup();
      return false;
    }
    if (opts.validateTarget) {
      if (primarySegmentIdx(view.state) !== segmentIdx) {
        cleanup();
        return false;
      }
      if (!isTranscriptSegmentVisible(view.state, segmentIdx)) {
        cleanup();
        return false;
      }
    }
    const geom = readRevealLineGeom(view, segmentIdx);
    if (
      mode === "ifChanged" &&
      lastGeom &&
      geom &&
      Math.abs(geom.top - lastGeom.top) < 1 &&
      Math.abs(geom.height - lastGeom.height) < 1
    ) {
      return true;
    }
    if (opts.preserveAnchor) {
      revealSegmentPreservingViewportOffsetInline(view, segmentIdx, opts.priorAnchorOffsetPx);
    } else {
      revealSegmentInScrollDOM(view, segmentIdx, { y: opts.y ?? "nearest" });
    }
    lastGeom = readRevealLineGeom(view, segmentIdx) ?? geom;
    return true;
  };

  run("force");
  if (!opts.deferLayout) {
    cleanup();
    return generation;
  }

  /**
   * Structure merges use preserveAnchor. Re-applying that after wrap measure
   * with a pre-merge offset stably jumps the list upward — only nudge if the
   * line start left the viewport.
   */
  if (opts.preserveAnchor) {
    if (typeof requestAnimationFrame !== "function") {
      cleanup();
      return generation;
    }
    requestAnimationFrame(() => {
      if (getRevealSchedule(view).generation !== generation) return;
      if (userInterrupted) {
        cleanup();
        return;
      }
      if (opts.validateTarget) {
        if (primarySegmentIdx(view.state) !== segmentIdx) {
          cleanup();
          return;
        }
        if (!isTranscriptSegmentVisible(view.state, segmentIdx)) {
          cleanup();
          return;
        }
      }
      const geom = readRevealLineGeom(view, segmentIdx);
      const top = scroller.scrollTop;
      const viewportH = Math.max(1, scroller.clientHeight);
      if (geom && (geom.top < top - 1 || geom.top > top + viewportH - 1)) {
        revealSegmentInScrollDOM(view, segmentIdx, { y: "nearest" });
      }
      cleanup();
    });
    return generation;
  }

  /** Non-anchor defer: re-scroll only when wrap/filter geometry moved. */
  const polish = () => {
    if (getRevealSchedule(view).generation !== generation) return;
    run("ifChanged");
  };

  if (typeof view.requestMeasure === "function") {
    view.requestMeasure({
      key: "rushi-structure-reveal",
      read: () => null,
      write: () => {
        polish();
      },
    });
  }

  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      polish();
      cleanup();
    });
  } else {
    polish();
    cleanup();
  }
  return generation;
}

/** Test helper: current reveal generation for a view. */
export function getRevealScheduleGenerationForTests(view: EditorView): number {
  return revealScheduleByView.get(view)?.generation ?? 0;
}
