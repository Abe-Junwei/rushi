// @vitest-environment jsdom

import { describe, expect, it, afterEach } from "vitest";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import {
  buildTranscriptEditorState,
  transcriptEditorCoreExtensions,
  syncTranscriptProjectionFromView,
} from "./index";
import {
  getTranscriptFilterVisibleSet,
  resolveNextVisibleSegmentIdx,
  setTranscriptFilterVisibleEffect,
} from "./filterLineVisibility";

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

describe("P9a filterLineVisibility", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("keeps doc.lines === segment count while hiding non-matching lines", () => {
    const view = mountCore(5);
    expect(view.state.doc.lines).toBe(5);

    const visible = new Set([1, 3]);
    view.dispatch({ effects: setTranscriptFilterVisibleEffect.of(visible) });

    expect(view.state.doc.lines).toBe(5);
    expect(getTranscriptFilterVisibleSet(view.state)).toEqual(visible);

    const hidden = view.dom.querySelectorAll(".cm-transcript-filter-hidden");
    expect(hidden.length).toBe(3);
  });

  it("resolveNextVisibleSegmentIdx skips hidden indices", () => {
    const view = mountCore(5);
    view.dispatch({
      effects: setTranscriptFilterVisibleEffect.of(new Set([0, 2, 4])),
    });

    expect(resolveNextVisibleSegmentIdx(view.state, 0, 1)).toBe(2);
    expect(resolveNextVisibleSegmentIdx(view.state, 2, 1)).toBe(4);
    expect(resolveNextVisibleSegmentIdx(view.state, 4, 1)).toBeNull();
    expect(resolveNextVisibleSegmentIdx(view.state, 2, -1)).toBe(0);
  });

  it("clears filter when effect is null", () => {
    const view = mountCore(3);
    view.dispatch({
      effects: setTranscriptFilterVisibleEffect.of(new Set([1])),
    });
    expect(view.dom.querySelectorAll(".cm-transcript-filter-hidden").length).toBe(2);

    view.dispatch({ effects: setTranscriptFilterVisibleEffect.of(null) });
    expect(getTranscriptFilterVisibleSet(view.state)).toBeNull();
    expect(view.dom.querySelectorAll(".cm-transcript-filter-hidden").length).toBe(0);
  });
});
