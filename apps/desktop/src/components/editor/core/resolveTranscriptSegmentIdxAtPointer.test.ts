// @vitest-environment jsdom

import { describe, expect, it, afterEach } from "vitest";
import { EditorView } from "@codemirror/view";
import { buildTranscriptEditorState, transcriptEditorCoreExtensions } from "./index";
import { resolveTranscriptSegmentIdxAtPointer } from "./resolveTranscriptSegmentIdxAtPointer";
import type { SegmentDto } from "../../../tauri/projectTypes";

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i,
    end_sec: i + 1,
    text: `语段${i}`,
    kind: "speech" as const,
  }));
}

function mountView(count: number): EditorView {
  const parent = document.createElement("div");
  parent.style.height = "320px";
  document.body.appendChild(parent);
  const state = buildTranscriptEditorState(makeSegments(count), {
    extensions: [
      ...transcriptEditorCoreExtensions({ withProjection: false, withMetaGutter: false }),
      EditorView.theme({
        "&": { height: "320px" },
        ".cm-scroller": { overflow: "auto", height: "100%" },
      }),
    ],
  });
  return new EditorView({ state, parent });
}

function lineElAt(view: EditorView, idx: number): Element {
  const pos = view.state.doc.line(idx + 1).from;
  const dom = view.domAtPos(pos).node;
  const el = dom instanceof Element ? dom : dom.parentElement;
  const lineEl = el?.closest(".cm-line");
  if (!lineEl) throw new Error(`no .cm-line for idx ${idx}`);
  return lineEl;
}

describe("resolveTranscriptSegmentIdxAtPointer", () => {
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
    view = null;
  });

  it("resolves from the DOM line of the pointer target (text click)", () => {
    view = mountView(5);
    for (const targetIdx of [0, 1, 2, 3, 4]) {
      const lineEl = lineElAt(view, targetIdx);
      expect(resolveTranscriptSegmentIdxAtPointer(view, 0, 0, lineEl)).toBe(targetIdx);
      // A text/descendant node inside the line resolves the same row.
      const inner = lineEl.firstChild ?? lineEl;
      expect(resolveTranscriptSegmentIdxAtPointer(view, 0, 0, inner)).toBe(targetIdx);
    }
  });

  it("resolves the target's OWN row even when height math would snap to the next line", () => {
    view = mountView(4);
    const targetIdx = 1;
    const lineEl = lineElAt(view, targetIdx);

    // Simulate the exact bug condition: height geometry points at the next row
    // (padding / resize-strip click), but the DOM target is this row.
    const nextBlock = view.lineBlockAt(view.state.doc.line(targetIdx + 2).from);
    const clientY = view.documentTop + nextBlock.top + 1;

    // Height fallback alone would return targetIdx+1; the DOM target wins.
    expect(resolveTranscriptSegmentIdxAtPointer(view, 0, clientY, lineEl)).toBe(targetIdx);
  });

  it("ignores targets outside the editor content and falls back to height", () => {
    view = mountView(4);
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    // Outside target is rejected; with clientY above the doc top, height fallback
    // returns null rather than a wrong row.
    expect(resolveTranscriptSegmentIdxAtPointer(view, 0, -9999, outside)).toBeNull();
    outside.remove();
  });
});
