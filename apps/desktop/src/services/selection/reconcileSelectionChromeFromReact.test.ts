// @vitest-environment jsdom

import { describe, expect, it, beforeEach } from "vitest";
import { reconcileSelectionChromeFromReact } from "./reconcileSelectionChromeFromReact";
import {
  commitSelectionChrome,
  getSelectionChromeSnapshot,
  markUserSelectionChromePending,
  resetSelectionChromeStoreForTests,
} from "./selectionChromeStore";

describe("reconcileSelectionChromeFromReact", () => {
  beforeEach(() => {
    resetSelectionChromeStoreForTests();
  });

  const segments = [
    { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "" },
    { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "" },
    { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "" },
  ];

  it("skips when store leads React before transition commit", () => {
    commitSelectionChrome({ fileId: "f1", primaryIdx: 2, selectedSet: new Set([2]) });
    markUserSelectionChromePending(getSelectionChromeSnapshot().version, segments.length);
    const changed = reconcileSelectionChromeFromReact({
      fileId: "f1",
      primaryIdx: 1,
      selectedIndices: [1],
      segments,
      listRoot: null,
      overlayRoot: null,
    });
    expect(changed).toBe(false);
    expect(getSelectionChromeSnapshot().primaryIdx).toBe(2);
  });

  it("repairs when React multi-select updates ahead of store", () => {
    commitSelectionChrome({ fileId: "f1", primaryIdx: 1, selectedSet: new Set([1]) });
    const listRoot = document.createElement("div");
    const row0 = document.createElement("div");
    row0.setAttribute("data-seg-row", "0");
    row0.className = "seg-row-shell bg-transparent";
    const row1 = document.createElement("div");
    row1.setAttribute("data-seg-row", "1");
    row1.className = "seg-row-shell seg-row-selected";
    listRoot.append(row0, row1);

    const changed = reconcileSelectionChromeFromReact({
      fileId: "f1",
      primaryIdx: 1,
      selectedIndices: [0, 1],
      segments,
      listRoot,
      overlayRoot: null,
    });
    expect(changed).toBe(true);
    expect(row0.classList.contains("seg-row-in-selection")).toBe(true);
    expect(getSelectionChromeSnapshot().selectedSet.has(0)).toBe(true);
  });

  it("repairs when React updates after structure mutation (merge/delete)", () => {
    commitSelectionChrome({ fileId: "f1", primaryIdx: 2, selectedSet: new Set([2]) });
    markUserSelectionChromePending(getSelectionChromeSnapshot().version, 3);

    const segmentsAfterDelete = [
      { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "" },
      { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "" },
    ];

    const changed = reconcileSelectionChromeFromReact({
      fileId: "f1",
      primaryIdx: 1,
      selectedIndices: [1],
      segments: segmentsAfterDelete,
      listRoot: null,
      overlayRoot: null,
    });
    expect(changed).toBe(true);
    expect(getSelectionChromeSnapshot().primaryIdx).toBe(1);
    expect(getSelectionChromeSnapshot().selectedSet.has(1)).toBe(true);
  });
});
