// @vitest-environment jsdom

import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import {
  buildTranscriptEditorState,
  transcriptEditorCoreExtensions,
  selectSegmentCommand,
  movePrimarySegmentCommand,
  primarySegmentIdx,
  getTranscriptMultiSelection,
  getTranscriptProjectionSnapshot,
  syncTranscriptProjectionFromView,
  resetTranscriptProjectionForTests,
  subscribeTranscriptProjection,
  subscribeTranscriptSelectionProjection,
  shouldConsumeTranscriptContentMousedown,
} from "./index";

function makeSegments(n: number): SegmentDto[] {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`,
    idx: i,
    start_sec: i,
    end_sec: i + 0.5,
    text: `语段 ${i}`,
  }));
}

function mountCore(n: number): EditorView {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const state = buildTranscriptEditorState(makeSegments(n), {
    extensions: transcriptEditorCoreExtensions(),
  });
  const view = new EditorView({ state, parent });
  syncTranscriptProjectionFromView(view);
  return view;
}

describe("P2 selection commands + projection", () => {
  let view: EditorView | null = null;

  beforeEach(() => {
    resetTranscriptProjectionForTests();
  });

  afterEach(() => {
    view?.destroy();
    view?.dom.parentElement?.remove();
    view = null;
    resetTranscriptProjectionForTests();
  });

  it("selectSegment replaces selection (single)", () => {
    view = mountCore(8);
    expect(selectSegmentCommand(view, 3)).toBe(true);
    expect(primarySegmentIdx(view.state)).toBe(3);
    expect([...getTranscriptMultiSelection(view.state).selectedSet]).toEqual([3]);
    expect(getTranscriptProjectionSnapshot().primaryIdx).toBe(3);
  });

  it("selectSegment can place caret at click position within the line", () => {
    view = mountCore(4);
    const line = view.state.doc.line(3);
    const caret = Math.min(line.from + 2, line.to);
    expect(selectSegmentCommand(view, 2, { caretPos: caret, scrollIntoView: false })).toBe(true);
    expect(primarySegmentIdx(view.state)).toBe(2);
    expect(view.state.selection.main.head).toBe(caret);
    expect(view.state.selection.main.empty).toBe(true);
  });

  it("toggle adds and removes indices", () => {
    view = mountCore(8);
    selectSegmentCommand(view, 1);
    selectSegmentCommand(view, 3, { toggle: true });
    expect(primarySegmentIdx(view.state)).toBe(3);
    expect(getTranscriptMultiSelection(view.state).selectedSet.has(1)).toBe(true);
    expect(getTranscriptMultiSelection(view.state).selectedSet.has(3)).toBe(true);

    selectSegmentCommand(view, 1, { toggle: true });
    expect(getTranscriptMultiSelection(view.state).selectedSet.has(1)).toBe(false);
    expect(primarySegmentIdx(view.state)).toBe(3);
  });

  it("shift expands range from anchor", () => {
    view = mountCore(10);
    selectSegmentCommand(view, 2);
    selectSegmentCommand(view, 5, { shiftKey: true });
    const set = getTranscriptMultiSelection(view.state).selectedSet;
    expect([...set].sort((a, b) => a - b)).toEqual([2, 3, 4, 5]);
    expect(primarySegmentIdx(view.state)).toBe(5);
    expect(getTranscriptMultiSelection(view.state).rangeAnchor).toBe(2);
  });

  it("movePrimary up/down and shift-move", () => {
    view = mountCore(6);
    selectSegmentCommand(view, 2);
    expect(movePrimarySegmentCommand(view, 1)).toBe(true);
    expect(primarySegmentIdx(view.state)).toBe(3);
    expect(movePrimarySegmentCommand(view, -1)).toBe(true);
    expect(primarySegmentIdx(view.state)).toBe(2);

    expect(movePrimarySegmentCommand(view, 1, { shiftKey: true })).toBe(true);
    const set = getTranscriptMultiSelection(view.state).selectedSet;
    expect(set.has(2) && set.has(3)).toBe(true);
  });

  it("movePrimary does not scrollIntoView by default (avoids ↑↓ chrome flash)", async () => {
    const { movePrimarySegmentTransaction } = await import("./selectionCommands");
    view = mountCore(8);
    selectSegmentCommand(view, 2, { scrollIntoView: false });
    const tr = movePrimarySegmentTransaction(view.state, 1);
    expect(tr?.scrollIntoView).toBe(false);
    const trForced = movePrimarySegmentTransaction(view.state, 1, { scrollIntoView: true });
    expect(trForced?.scrollIntoView).toBe(true);
  });

  it("movePrimary swaps primary line class in one transaction (no dual-row chrome)", () => {
    view = mountCore(6);
    selectSegmentCommand(view, 2, { scrollIntoView: false });
    expect(view.contentDOM.querySelectorAll(".cm-transcript-primary-line")).toHaveLength(1);
    expect(primarySegmentIdx(view.state)).toBe(2);

    movePrimarySegmentCommand(view, 1);
    expect(primarySegmentIdx(view.state)).toBe(3);
    const primaries = view.contentDOM.querySelectorAll(".cm-transcript-primary-line");
    expect(primaries).toHaveLength(1);
    expect(view.state.doc.lineAt(view.state.selection.main.head).number).toBe(4);
    // Decoration attach to the new primary line only.
    expect(primaries[0]?.textContent ?? "").toContain("语段 3");
  });

  it("projection notifies subscribers unidirectionally", () => {
    view = mountCore(5);
    let ticks = 0;
    const unsub = subscribeTranscriptProjection(() => {
      ticks += 1;
    });
    selectSegmentCommand(view, 4);
    expect(ticks).toBeGreaterThan(0);
    expect(getTranscriptProjectionSnapshot().primaryIdx).toBe(4);
    expect(getTranscriptProjectionSnapshot().selectedSet.has(4)).toBe(true);
    unsub();
  });

  it("text edits do not notify selection-only projection subscribers", () => {
    view = mountCore(5);
    selectSegmentCommand(view, 1);
    let allTicks = 0;
    let selectionTicks = 0;
    const unsubAll = subscribeTranscriptProjection(() => {
      allTicks += 1;
    });
    const unsubSelection = subscribeTranscriptSelectionProjection(() => {
      selectionTicks += 1;
    });
    const beforeSelectionVersion = getTranscriptProjectionSnapshot().selectionVersion;
    const line = view.state.doc.line(2);

    view.dispatch({ changes: { from: line.from, to: line.to, insert: "typed" } });

    expect(allTicks).toBeGreaterThan(0);
    expect(selectionTicks).toBe(0);
    expect(getTranscriptProjectionSnapshot().selectionVersion).toBe(beforeSelectionVersion);
    unsubAll();
    unsubSelection();
  });

  it("paints primary decoration class on selected line", () => {
    view = mountCore(5);
    selectSegmentCommand(view, 2);
    expect(view.dom.querySelector(".cm-transcript-primary-line")).toBeTruthy();
  });

  it("keeps primary line class after typing at line start (no map drop)", () => {
    view = mountCore(5);
    selectSegmentCommand(view, 2);
    const line = view.state.doc.line(3);
    view.dispatch({ changes: { from: line.from, insert: "前" } });
    expect(primarySegmentIdx(view.state)).toBe(2);
    expect(view.dom.querySelector(".cm-transcript-primary-line")).toBeTruthy();
  });
});

describe("shouldConsumeTranscriptContentMousedown", () => {
  it("consumes when switching segment or multi-selecting", () => {
    expect(
      shouldConsumeTranscriptContentMousedown({
        clickedIdx: 3,
        primaryIdx: 0,
        shiftKey: false,
        toggle: false,
      }),
    ).toBe(true);
    expect(
      shouldConsumeTranscriptContentMousedown({
        clickedIdx: 0,
        primaryIdx: 0,
        shiftKey: true,
        toggle: false,
      }),
    ).toBe(true);
    expect(
      shouldConsumeTranscriptContentMousedown({
        clickedIdx: 0,
        primaryIdx: 0,
        shiftKey: false,
        toggle: true,
      }),
    ).toBe(true);
  });

  it("does not consume same-segment plain click (allow text drag-select)", () => {
    expect(
      shouldConsumeTranscriptContentMousedown({
        clickedIdx: 2,
        primaryIdx: 2,
        shiftKey: false,
        toggle: false,
      }),
    ).toBe(false);
  });
});
