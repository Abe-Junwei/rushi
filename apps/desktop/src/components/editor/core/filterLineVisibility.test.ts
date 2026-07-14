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
  computeFilterHiddenRuns,
  getTranscriptFilterCriteria,
  getTranscriptFilterGeneration,
  getTranscriptFilterHiddenRuns,
  getTranscriptFilterVisibleSet,
  resolveNextVisibleSegmentIdx,
  setTranscriptFilterCriteriaEffect,
  setTranscriptFilterVisibleEffect,
} from "./filterLineVisibility";
import { DEFAULT_SEGMENT_LIST_FILTER } from "../../../services/segmentListFilter";
import { setSegmentMetaEffect } from "./segmentMetaField";
import { segmentDtoToMeta } from "./structureCommands";

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

    // One widget per contiguous hidden run (0 | 2 | 4 → three runs).
    const collapses = view.dom.querySelectorAll(".cm-transcript-filter-collapse");
    expect(collapses.length).toBe(3);
  });

  it("merges contiguous hidden lines into one collapse widget per run", () => {
    const view = mountCore(10);
    view.dispatch({
      effects: setTranscriptFilterVisibleEffect.of(new Set([2, 7])),
    });
    // Hidden runs: [0,1], [3,4,5,6], [8,9] → 3 widgets (not 8).
    expect(view.dom.querySelectorAll(".cm-transcript-filter-collapse").length).toBe(3);
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
    expect(view.dom.querySelectorAll(".cm-transcript-filter-collapse").length).toBe(2);

    view.dispatch({ effects: setTranscriptFilterVisibleEffect.of(null) });
    expect(getTranscriptFilterVisibleSet(view.state)).toBeNull();
    expect(view.dom.querySelectorAll(".cm-transcript-filter-collapse").length).toBe(0);
  });

  it("omits meta gutter markers for hidden lines so timestamps do not stack", () => {
    const view = mountCore(5);
    view.dispatch({
      effects: setTranscriptFilterVisibleEffect.of(new Set([1, 3])),
    });

    // initialSpacer also mounts a TranscriptMetaMarker ("1. 00:00:00").
    const markers = [
      ...view.dom.querySelectorAll(".cm-transcript-meta-gutter .cm-transcript-meta-marker"),
    ] as HTMLElement[];
    const lineMarkers = markers.filter((m) => m.title !== "1. 00:00:00");
    expect(lineMarkers).toHaveLength(2);
    expect(lineMarkers.map((m) => m.title)).toEqual([
      expect.stringMatching(/^2\./),
      expect.stringMatching(/^4\./),
    ]);
    for (const m of lineMarkers) {
      expect(m.querySelectorAll(".cm-transcript-meta-index")).toHaveLength(1);
      expect(m.querySelectorAll(".cm-transcript-meta-time")).toHaveLength(1);
    }
    // Hidden segment indices must not leave marker DOM behind.
    const indexLabels = lineMarkers.map(
      (m) => m.querySelector(".cm-transcript-meta-index")?.textContent,
    );
    expect(indexLabels).toEqual(["2.", "4."]);
  });

  it("collapses hidden lines so contentHeight only counts visible rows", () => {
    const view = mountCore(5);
    const before = view.contentHeight;
    view.dispatch({
      effects: setTranscriptFilterVisibleEffect.of(new Set([2])),
    });
    // One visible row: content height should drop near a single line (not 5×).
    expect(view.contentHeight).toBeLessThan(before * 0.45);
    expect(view.contentHeight).toBeGreaterThan(0);
    // Clearing filter restores full height.
    view.dispatch({ effects: setTranscriptFilterVisibleEffect.of(null) });
    expect(view.contentHeight).toBeGreaterThan(before * 0.9);
  });

  it("keeps frozen line class on the first visible row after filter collapse", () => {
    const segs = Array.from({ length: 6 }, (_, i) => ({
      uid: `u${i}`,
      idx: i,
      start_sec: i,
      end_sec: i + 0.5,
      text: `语段 ${i}`,
      frozen: i >= 2,
    }));
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    const view = new EditorView({
      state: buildTranscriptEditorState(segs, {
        extensions: transcriptEditorCoreExtensions(),
      }),
      parent,
    });
    syncTranscriptProjectionFromView(view);
    view.dispatch({
      effects: setTranscriptFilterVisibleEffect.of(new Set([2, 3, 4, 5])),
    });

    const frozenLines = [
      ...view.dom.querySelectorAll(".cm-line.cm-transcript-frozen-line"),
    ];
    expect(frozenLines.map((el) => el.textContent)).toEqual([
      "语段 2",
      "语段 3",
      "语段 4",
      "语段 5",
    ]);
  });

  it("stores criteria and recomputes visible set when meta is replaced", () => {
    const view = mountCore(4);
    const criteria = {
      ...DEFAULT_SEGMENT_LIST_FILTER,
      frozen: "frozen" as const,
    };
    view.dispatch({
      effects: [
        setTranscriptFilterCriteriaEffect.of(criteria),
        setTranscriptFilterVisibleEffect.of(new Set()),
      ],
    });
    expect(getTranscriptFilterCriteria(view.state)).toEqual(criteria);
    const gen0 = getTranscriptFilterGeneration(view.state);

    const next = makeSegments(4).map((s, i) => ({ ...s, frozen: i === 1 || i === 3 }));
    view.dispatch({
      effects: setSegmentMetaEffect.of(next.map((s, i) => segmentDtoToMeta(s, i))),
    });
    expect([...getTranscriptFilterVisibleSet(view.state)!].sort((a, b) => a - b)).toEqual([1, 3]);
    expect(getTranscriptFilterGeneration(view.state)).toBeGreaterThan(gen0);
    expect(getTranscriptFilterHiddenRuns(view.state)).toEqual([
      { fromIdx: 0, toIdxInclusive: 0 },
      { fromIdx: 2, toIdxInclusive: 2 },
    ]);
  });

  it("computeFilterHiddenRuns covers first/last/all-hidden", () => {
    expect(computeFilterHiddenRuns(5, new Set([0, 4]))).toEqual([
      { fromIdx: 1, toIdxInclusive: 3 },
    ]);
    expect(computeFilterHiddenRuns(3, new Set())).toEqual([
      { fromIdx: 0, toIdxInclusive: 2 },
    ]);
    expect(computeFilterHiddenRuns(3, null)).toEqual([]);
  });

  it("text edit with unchanged line count keeps generation and remaps decorations from runs", () => {
    const view = mountCore(5);
    view.dispatch({
      effects: setTranscriptFilterVisibleEffect.of(new Set([1, 3])),
    });
    const gen = getTranscriptFilterGeneration(view.state);
    const runs = getTranscriptFilterHiddenRuns(view.state);
    const line = view.state.doc.line(2);
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: "edited" },
    });
    expect(getTranscriptFilterGeneration(view.state)).toBe(gen);
    expect(getTranscriptFilterHiddenRuns(view.state)).toEqual(runs);
    expect(view.dom.querySelectorAll(".cm-transcript-filter-collapse").length).toBe(3);
  });
});
