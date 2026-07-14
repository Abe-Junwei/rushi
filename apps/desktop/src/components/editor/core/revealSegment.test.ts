import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { revealSegmentInScrollDOM } from "./revealSegment";

function makeView() {
  const state = EditorState.create({ doc: "a\nb\nc\nd" });
  const scrollDOM = document.createElement("div");
  Object.defineProperty(scrollDOM, "clientHeight", { configurable: true, value: 100 });
  Object.defineProperty(scrollDOM, "scrollHeight", { configurable: true, value: 500 });
  Object.defineProperty(scrollDOM, "scrollTop", { configurable: true, writable: true, value: 0 });
  const view = {
    state,
    scrollDOM,
    lineBlockAt(pos: number) {
      const line = state.doc.lineAt(pos);
      const top = (line.number - 1) * 100;
      return {
        from: line.from,
        to: line.to,
        top,
        bottom: top + 50,
        height: 50,
        type: "text",
      };
    },
  } as unknown as EditorView;
  return { view, scrollDOM };
}

describe("revealSegmentInScrollDOM", () => {
  it("centers by writing only the CodeMirror scroller", () => {
    const { view, scrollDOM } = makeView();

    expect(revealSegmentInScrollDOM(view, 2, { y: "center" })).toBe(true);

    expect(scrollDOM.scrollTop).toBe(175);
  });

  it("keeps nearest visible lines stable", () => {
    const { view, scrollDOM } = makeView();
    scrollDOM.scrollTop = 100;

    expect(revealSegmentInScrollDOM(view, 1, { y: "nearest" })).toBe(true);

    expect(scrollDOM.scrollTop).toBe(100);
  });

  it("does not jump to bottom of oversized nearest line (merge wrap case)", () => {
    const state = EditorState.create({ doc: "merged-tall-line\nb\nc" });
    const scrollDOM = document.createElement("div");
    Object.defineProperty(scrollDOM, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(scrollDOM, "scrollHeight", { configurable: true, value: 2000 });
    // Line start still inside viewport; only the wrapped bottom overflows.
    Object.defineProperty(scrollDOM, "scrollTop", { configurable: true, writable: true, value: 40 });
    const view = {
      state,
      scrollDOM,
      lineBlockAt() {
        return { from: 0, to: 16, top: 50, bottom: 900, height: 850, type: "text" };
      },
    } as unknown as EditorView;

    expect(revealSegmentInScrollDOM(view, 0, { y: "nearest" })).toBe(true);
    // Keep current scroll — do not snap to bottom (900 - 200 = 700).
    expect(scrollDOM.scrollTop).toBe(40);
  });

  it("nearest oversized line scrolls up only when top is above viewport", () => {
    const state = EditorState.create({ doc: "merged-tall-line\nb" });
    const scrollDOM = document.createElement("div");
    Object.defineProperty(scrollDOM, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(scrollDOM, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(scrollDOM, "scrollTop", { configurable: true, writable: true, value: 400 });
    const view = {
      state,
      scrollDOM,
      lineBlockAt() {
        return { from: 0, to: 16, top: 50, bottom: 900, height: 850, type: "text" };
      },
    } as unknown as EditorView;

    expect(revealSegmentInScrollDOM(view, 0, { y: "nearest" })).toBe(true);
    expect(scrollDOM.scrollTop).toBe(50);
  });

  it("rejects missing segment indices", () => {
    const { view } = makeView();

    expect(revealSegmentInScrollDOM(view, 99, { y: "center" })).toBe(false);
  });
});
