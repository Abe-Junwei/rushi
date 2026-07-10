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

  it("paints primary decoration class on selected line", () => {
    view = mountCore(5);
    selectSegmentCommand(view, 2);
    expect(view.dom.querySelector(".cm-transcript-primary-line")).toBeTruthy();
  });
});
