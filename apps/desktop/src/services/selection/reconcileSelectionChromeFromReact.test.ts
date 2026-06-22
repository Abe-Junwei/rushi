import { describe, expect, it, beforeEach } from "vitest";
import {
  commitSelectionChrome,
  getSelectionChromeSnapshot,
  resetSelectionChromeStoreForTests,
} from "./selectionChromeStore";
import {
  reconcileSelectionChromeFromReact,
  selectionChromeNeedsReconcile,
} from "./reconcileSelectionChromeFromReact";

describe("reconcileSelectionChromeFromReact", () => {
  beforeEach(() => {
    resetSelectionChromeStoreForTests();
  });

  it("detects store vs React mismatch", () => {
    commitSelectionChrome({ fileId: "f1", primaryIdx: 0, selectedSet: new Set([0]) });
    expect(
      selectionChromeNeedsReconcile({
        fileId: "f1",
        primaryIdx: 2,
        selectedIndices: [2],
        segments: [
          { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "" },
          { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "" },
          { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "" },
        ],
        listRoot: document.createElement("div"),
        overlayRoot: null,
      }),
    ).toBe(true);
  });

  it("reconciles list row chrome when React SC1 advances", () => {
    const listRoot = document.createElement("div");
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "2");
    row.className = "seg-row-shell";
    listRoot.append(row);

    commitSelectionChrome({ fileId: "f1", primaryIdx: 0, selectedSet: new Set([0]) });

    const changed = reconcileSelectionChromeFromReact({
      fileId: "f1",
      primaryIdx: 2,
      selectedIndices: [2],
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "" },
        { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "" },
      ],
      listRoot,
      overlayRoot: null,
    });

    expect(changed).toBe(true);
    expect(getSelectionChromeSnapshot().primaryIdx).toBe(2);
    expect(row.classList.contains("seg-row-selected")).toBe(true);
  });

  it("no-ops when store already matches React", () => {
    commitSelectionChrome({ fileId: "f1", primaryIdx: 1, selectedSet: new Set([1]) });
    const versionBefore = getSelectionChromeSnapshot().version;
    const segments = [
      { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "" },
      { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "" },
    ];
    const changed = reconcileSelectionChromeFromReact({
      fileId: "f1",
      primaryIdx: 1,
      selectedIndices: [1],
      segments,
      listRoot: document.createElement("div"),
      overlayRoot: null,
    });
    expect(changed).toBe(false);
    expect(getSelectionChromeSnapshot().version).toBe(versionBefore);
  });
});
