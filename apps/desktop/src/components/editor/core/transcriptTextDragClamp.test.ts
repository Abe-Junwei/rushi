// @vitest-environment jsdom

import { describe, expect, it, afterEach } from "vitest";
import { EditorSelection, Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { buildTranscriptEditorState } from "./buildTranscriptEditorState";
import { transcriptEditorCoreExtensions } from "./transcriptEditorCoreExtensions";
import { selectSegmentCommand } from "./selectionCommands";
import {
  clampEditorSelectionToDocLine,
  createTranscriptTextDragClamp,
  selectionCrossesDocLine,
  setTranscriptTextDragLineEffect,
  transcriptTextDragLineField,
} from "./transcriptTextDragClamp";

function makeSegments(n: number, text = "abcdefghij"): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i,
    end_sec: i + 1,
    text: `${text}${i}`,
    kind: "speech" as const,
  }));
}

function selRange(anchor: number, head: number): EditorSelection {
  return EditorSelection.create([EditorSelection.range(anchor, head)]);
}

describe("clampEditorSelectionToDocLine", () => {
  const doc = Text.of(["alpha", "bravo", "charlie"]);

  it("leaves same-line selection unchanged", () => {
    const line = doc.line(1);
    const sel = selRange(line.from + 1, line.from + 3);
    expect(clampEditorSelectionToDocLine(doc, sel, 1).eq(sel)).toBe(true);
    expect(selectionCrossesDocLine(doc, sel, 1)).toBe(false);
  });

  it("clamps forward cross-line selection to the anchor line end", () => {
    const line1 = doc.line(1);
    const line2 = doc.line(2);
    const sel = selRange(line1.from + 1, line2.from + 2);
    expect(selectionCrossesDocLine(doc, sel, 1)).toBe(true);
    const clamped = clampEditorSelectionToDocLine(doc, sel, 1);
    expect(clamped.main.anchor).toBe(line1.from + 1);
    expect(clamped.main.head).toBe(line1.to);
    expect(doc.lineAt(clamped.main.head).number).toBe(1);
  });

  it("clamps backward cross-line selection to the anchor line start", () => {
    const line1 = doc.line(1);
    const line2 = doc.line(2);
    // Drag upward: anchor on line 2, head on line 1
    const sel = selRange(line2.from + 2, line1.from + 1);
    const clamped = clampEditorSelectionToDocLine(doc, sel, 2);
    expect(clamped.main.anchor).toBe(line2.from + 2);
    expect(clamped.main.head).toBe(line2.from);
    expect(doc.lineAt(clamped.main.anchor).number).toBe(2);
    expect(doc.lineAt(clamped.main.head).number).toBe(2);
  });

  it("does not treat within-line ranges as crossing even when long", () => {
    const long = Text.of(["word ".repeat(40).trim()]);
    const line = long.line(1);
    const sel = selRange(line.from, line.to);
    expect(selectionCrossesDocLine(long, sel, 1)).toBe(false);
    expect(clampEditorSelectionToDocLine(long, sel, 1).eq(sel)).toBe(true);
  });
});

describe("createTranscriptTextDragClamp", () => {
  let view: EditorView | null = null;

  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
    view = null;
  });

  function mount(): EditorView {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const state = buildTranscriptEditorState(makeSegments(3), {
      extensions: [
        ...transcriptEditorCoreExtensions({ withProjection: false }),
        ...createTranscriptTextDragClamp(),
      ],
    });
    view = new EditorView({ state, parent });
    return view;
  }

  it("clamps selection that crosses into the next segment while drag line is set", () => {
    const v = mount();
    selectSegmentCommand(v, 0, { scrollIntoView: false });
    v.dispatch({ effects: setTranscriptTextDragLineEffect.of(1) });
    expect(v.state.field(transcriptTextDragLineField)).toBe(1);

    const line1 = v.state.doc.line(1);
    const line2 = v.state.doc.line(2);
    v.dispatch({
      selection: selRange(line1.from + 1, line2.from + 2),
    });

    const main = v.state.selection.main;
    expect(v.state.doc.lineAt(main.anchor).number).toBe(1);
    expect(v.state.doc.lineAt(main.head).number).toBe(1);
    expect(main.head).toBe(line1.to);
  });

  it("does not clamp after drag line is cleared", () => {
    const v = mount();
    selectSegmentCommand(v, 0, { scrollIntoView: false });
    v.dispatch({ effects: setTranscriptTextDragLineEffect.of(1) });
    v.dispatch({ effects: setTranscriptTextDragLineEffect.of(null) });

    const line1 = v.state.doc.line(1);
    const line2 = v.state.doc.line(2);
    v.dispatch({
      selection: selRange(line1.from + 1, line2.from + 2),
    });

    const main = v.state.selection.main;
    expect(v.state.doc.lineAt(main.head).number).toBe(2);
  });

  it("allows within-line selection while drag line is set", () => {
    const v = mount();
    selectSegmentCommand(v, 0, { scrollIntoView: false });
    v.dispatch({ effects: setTranscriptTextDragLineEffect.of(1) });

    const line1 = v.state.doc.line(1);
    const from = line1.from + 1;
    const to = Math.min(line1.from + 4, line1.to);
    v.dispatch({ selection: selRange(from, to) });

    expect(v.state.selection.main.from).toBe(from);
    expect(v.state.selection.main.to).toBe(to);
  });
});
