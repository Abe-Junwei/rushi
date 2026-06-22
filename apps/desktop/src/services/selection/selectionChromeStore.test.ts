import { describe, expect, it, beforeEach } from "vitest";
import {
  commitSelectionChrome,
  getSelectionChromeSnapshot,
  resetSelectionChromeStoreForTests,
  SELECTION_ROW_STATE,
  selectionRowState,
  selectionChromePrimaryOutOfSync,
  subscribeSelectionChrome,
} from "./selectionChromeStore";

describe("selectionChromeStore", () => {
  beforeEach(() => {
    resetSelectionChromeStoreForTests();
  });

  it("commit updates primary and selected set", () => {
    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: 2,
      selectedSet: new Set([2]),
    });
    const snap = getSelectionChromeSnapshot();
    expect(snap.primaryIdx).toBe(2);
    expect(snap.selectedSet.has(2)).toBe(true);
    expect(snap.version).toBe(1);
  });

  it("notifies subscribers on commit", () => {
    let calls = 0;
    const unsub = subscribeSelectionChrome(() => {
      calls += 1;
    });
    commitSelectionChrome({ fileId: "f1", primaryIdx: 1, selectedSet: new Set([1]) });
    expect(calls).toBe(1);
    unsub();
  });

  it("selectionRowState returns stable references until store changes", () => {
    commitSelectionChrome({
      fileId: "f1",
      primaryIdx: 2,
      selectedSet: new Set([1, 2, 3]),
    });
    expect(selectionRowState(2)).toBe(SELECTION_ROW_STATE.primary);
    expect(selectionRowState(2)).toBe(SELECTION_ROW_STATE.primary);
    expect(selectionRowState(99)).toBe(SELECTION_ROW_STATE.none);
    expect(selectionRowState(99)).toBe(SELECTION_ROW_STATE.none);
  });

  it("selectionChromePrimaryOutOfSync detects reset store vs React selectedIdx", () => {
    expect(selectionChromePrimaryOutOfSync(0)).toBe(true);
    commitSelectionChrome({ fileId: "f1", primaryIdx: 0, selectedSet: new Set([0]) });
    expect(selectionChromePrimaryOutOfSync(0)).toBe(false);
    expect(selectionChromePrimaryOutOfSync(1)).toBe(true);
  });
});
