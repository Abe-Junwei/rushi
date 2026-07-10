import { describe, expect, it, beforeEach } from "vitest";
import { resolveWaveformSelectionChromeView } from "./resolveWaveformSelectionChromeView";
import {
  commitSelectionChrome,
  resetSelectionChromeStoreForTests,
} from "./selectionChromeStore";

describe("resolveWaveformSelectionChromeView", () => {
  beforeEach(() => {
    resetSelectionChromeStoreForTests();
  });

  it("prefers chrome store over stale React selectedIdx", () => {
    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: 5,
      selectedSet: new Set([5]),
    });

    const view = resolveWaveformSelectionChromeView({
      fileId: "f1",
      selectedIdx: 2,
      selectionLo: 2,
      selectionHi: 2,
      selectionCount: 1,
      isContiguousSelection: true,
    });

    expect(view.selectedIdx).toBe(5);
    expect(view.selectedIndices?.has(5)).toBe(true);
  });

  it("falls back to React when store has no primary", () => {
    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: -1,
      selectedSet: new Set(),
    });

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

  it("keeps store chrome when filter hides the primary segment (SC-H6 + list banner)", () => {
    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: 5,
      selectedSet: new Set([5]),
    });

    const view = resolveWaveformSelectionChromeView({
      fileId: "f1",
      selectedIdx: 5,
      selectionLo: 5,
      selectionHi: 5,
      selectionCount: 1,
      isContiguousSelection: true,
      filterExcludesPrimary: true,
    });

    expect(view.selectedIdx).toBe(5);
    expect(view.selectionCount).toBe(1);
  });

  it("falls back to React when store primary is out of range after delete", () => {
    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: 5,
      selectedSet: new Set([5]),
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
