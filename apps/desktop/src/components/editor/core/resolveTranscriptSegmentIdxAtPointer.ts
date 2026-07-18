import type { EditorView } from "@codemirror/view";

/**
 * Map a screen pointer to a 0-based segment/line index.
 *
 * DOM-first: the browser has already hit-tested the pointer to a concrete node
 * (mousedown/contextmenu `event.target`), so the nearest `.cm-line` ancestor is
 * the *visually* clicked row — including clicks in row padding or on the bottom
 * `.cm-transcript-row-height-resize` overlay (both live inside the line's DOM).
 * `posAtCoords`/`lineBlockAtHeight` instead do height math that snaps padding /
 * strip clicks onto the *next* doc line, and the error grows with wrapped/tall
 * rows — the "个别修好、很多仍偏一条" symptom.
 *
 * Height geometry (relative to `EditorView.documentTop`, matching CM6's own
 * gutter hit-testing) is kept only as a fallback for clicks that land outside
 * any line element (e.g. `.cm-content` bottom padding).
 */
export function resolveTranscriptSegmentIdxAtPointer(
  view: EditorView,
  clientX: number,
  clientY: number,
  target?: EventTarget | null,
): number | null {
  const el = resolveElementFromTarget(target);

  // Left meta / other gutters live outside `.cm-content`. Map by row height so
  // hover (and play-button force-reveal) stays active across the timestamp seam.
  if (el && view.dom.contains(el) && !view.contentDOM.contains(el)) {
    const fromGutter = resolveIdxFromHeight(view, clientY);
    if (fromGutter != null) return fromGutter;
  }

  const fromLineEl = resolveIdxFromLineElement(view, el);
  if (fromLineEl != null) return fromLineEl;

  // Browser hit-test at the raw coords (covers cases where target was detached
  // or was the scroller); still resolves to the visually correct `.cm-line`.
  const doc = view.contentDOM.ownerDocument;
  const hit =
    typeof doc?.elementFromPoint === "function"
      ? doc.elementFromPoint(clientX, clientY)
      : null;
  const fromHit = resolveIdxFromLineElement(view, hit);
  if (fromHit != null) return fromHit;

  return resolveIdxFromHeight(view, clientY);
}

function resolveElementFromTarget(target: EventTarget | null | undefined): Element | null {
  if (!target) return null;
  if (target instanceof Element) return target;
  // Text node → its owning element.
  if (target instanceof Node && target.parentElement) return target.parentElement;
  return null;
}

function resolveIdxFromLineElement(view: EditorView, el: Element | null): number | null {
  if (!el || !view.contentDOM.contains(el)) return null;
  const lineEl = el.closest(".cm-line");
  if (!lineEl || !view.contentDOM.contains(lineEl)) return null;
  try {
    const pos = view.posAtDOM(lineEl, 0);
    if (pos < 0 || pos > view.state.doc.length) return null;
    return view.state.doc.lineAt(pos).number - 1;
  } catch {
    return null;
  }
}

function resolveIdxFromHeight(view: EditorView, clientY: number): number | null {
  try {
    const height = clientY - view.documentTop;
    if (height < 0) return null;

    const blocks = view.viewportLineBlocks;
    if (blocks.length > 0 && height >= blocks[0].top && height <= blocks[blocks.length - 1].bottom) {
      const hit = blocks.find((b) => height >= b.top && height <= b.bottom);
      if (hit && hit.from >= 0 && hit.from <= view.state.doc.length) {
        return view.state.doc.lineAt(hit.from).number - 1;
      }
    }

    const block = view.lineBlockAtHeight(height);
    if (block.from < 0 || block.from > view.state.doc.length) return null;
    return view.state.doc.lineAt(block.from).number - 1;
  } catch {
    return null;
  }
}
