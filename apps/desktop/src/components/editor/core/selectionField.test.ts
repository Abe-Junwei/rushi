// @vitest-environment jsdom

import { describe, expect, it, afterEach } from "vitest";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import {
  buildTranscriptEditorState,
  transcriptEditorCoreExtensions,
  selectSegmentCommand,
  movePrimarySegmentCommand,
  primarySegmentIdx,
  getTranscriptMultiSelection,
} from "./index";
import { resolveTranscriptSegmentIdxAtPointer } from "./resolveTranscriptSegmentIdxAtPointer";

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

function mount(count: number): EditorView {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const state = buildTranscriptEditorState(makeSegments(count), {
    extensions: transcriptEditorCoreExtensions({ withProjection: false }),
  });
  return new EditorView({ state, parent });
}

function lineElAt(view: EditorView, idx: number): Element {
  const pos = view.state.doc.line(idx + 1).from;
  const node = view.domAtPos(pos).node;
  const el = node instanceof Element ? node : node.parentElement;
  const lineEl = el?.closest(".cm-line");
  if (!lineEl) throw new Error(`no .cm-line for idx ${idx}`);
  return lineEl;
}

describe("transcript primary segment: explicit, decoupled from caret drift", () => {
  let view: EditorView | null = null;
  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
    view = null;
  });

  it("holds primary when a bare caret change lands on another segment (right-click drift)", () => {
    view = mount(5);
    selectSegmentCommand(view, 1, { scrollIntoView: false });
    expect(primarySegmentIdx(view.state)).toBe(1);

    // Simulate the browser moving the DOM caret to segment 3 (no multi-select
    // effect, no doc edit) — exactly what CM's selectionchange readback does on
    // a right-click near a line boundary. Caret-derived primary would report 3.
    view.dispatch({ selection: EditorSelection.single(view.state.doc.line(4).from) });

    expect(primarySegmentIdx(view.state)).toBe(1);
  });

  it("still follows explicit selection commands (click switch / arrow nav)", () => {
    view = mount(5);
    selectSegmentCommand(view, 2, { scrollIntoView: false });
    expect(primarySegmentIdx(view.state)).toBe(2);

    movePrimarySegmentCommand(view, 1);
    expect(primarySegmentIdx(view.state)).toBe(3);

    selectSegmentCommand(view, 0, { scrollIntoView: false });
    expect(primarySegmentIdx(view.state)).toBe(0);
  });

  it("resolves the right-clicked row and commits it as primary (context-menu path)", () => {
    view = mount(5);
    selectSegmentCommand(view, 0, { scrollIntoView: false });

    // Mirror the mousedown/contextmenu handler: resolve idx from the DOM target,
    // commit it as the sole primary. Then a stray caret drift must not move it.
    const targetIdx = 3;
    const idx = resolveTranscriptSegmentIdxAtPointer(view, 0, 0, lineElAt(view, targetIdx));
    expect(idx).toBe(targetIdx);
    selectSegmentCommand(view, idx!, { scrollIntoView: false });
    expect(primarySegmentIdx(view.state)).toBe(targetIdx);
    expect(getTranscriptMultiSelection(view.state).primaryIdx).toBe(targetIdx);

    view.dispatch({ selection: EditorSelection.single(view.state.doc.line(5).from) });
    expect(primarySegmentIdx(view.state)).toBe(targetIdx);
  });
});
