import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolveWaveformSelectionChromeView } from "./resolveWaveformSelectionChromeView";
import {
  resetTranscriptProjectionForTests,
  seedTranscriptProjectionForTests,
} from "../../components/editor/core/transcriptProjection";

describe("resolveWaveformSelectionChromeView", () => {
  beforeEach(() => {
    resetTranscriptProjectionForTests();
  });

  afterEach(() => {
    resetTranscriptProjectionForTests();
  });

  it("prefers transcriptProjection over stale React selectedIdx", () => {
    seedTranscriptProjectionForTests({
      primaryIdx: 5,
      selectedSet: new Set([5]),
      rangeAnchor: 5,
      lineCount: 10,
    });

    const view = resolveWaveformSelectionChromeView({
      fileId: "f1",
      selectedIdx: 2,
      selectionLo: 2,
      selectionHi: 2,
      selectionCount: 1,
      isContiguousSelection: true,
      segmentCount: 10,
    });

    expect(view.selectedIdx).toBe(5);
    expect(view.selectedIndices?.has(5)).toBe(true);
  });

  it("falls back to React when projection has no primary", () => {
    const view = resolveWaveformSelectionChromeView({
      fileId: "f1",
      selectedIdx: 2,
      selectionLo: 2,
      selectionHi: 2,
      selectionCount: 1,
      isContiguousSelection: true,
    });

    expect(view.selectedIdx).toBe(2);
  });

  it("keeps projection primary when filter hides the primary segment (SC-H6 + list banner)", () => {
    seedTranscriptProjectionForTests({
      primaryIdx: 5,
      selectedSet: new Set([5]),
      rangeAnchor: 5,
      lineCount: 10,
    });

    const view = resolveWaveformSelectionChromeView({
      fileId: "f1",
      selectedIdx: 5,
      selectionLo: 5,
      selectionHi: 5,
      selectionCount: 1,
      isContiguousSelection: true,
      filterExcludesPrimary: true,
      segmentCount: 10,
    });

    expect(view.selectedIdx).toBe(5);
    expect(view.selectionCount).toBe(1);
  });

  it("falls back to React when projection primary is out of range after delete", () => {
    seedTranscriptProjectionForTests({
      primaryIdx: 5,
      selectedSet: new Set([5]),
      rangeAnchor: 5,
      lineCount: 10,
    });

    const view = resolveWaveformSelectionChromeView({
      fileId: "f1",
      selectedIdx: 2,
      selectionLo: 2,
      selectionHi: 2,
      selectionCount: 1,
      isContiguousSelection: true,
      segmentCount: 5,
    });

    expect(view.selectedIdx).toBe(2);
  });
});
