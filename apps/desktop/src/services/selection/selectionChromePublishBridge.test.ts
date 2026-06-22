// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  publishSelectionChromeForControllerState,
  registerSelectionChromePublishRoots,
  resetSelectionChromeForFile,
} from "./selectionChromePublishBridge";
import { getSelectionChromeSnapshot, resetSelectionChromeStoreForTests } from "./selectionChromeStore";

describe("selectionChromePublishBridge", () => {
  beforeEach(() => {
    resetSelectionChromeStoreForTests();
    registerSelectionChromePublishRoots(null);
  });

  it("publishSelectionChromeForControllerState no-ops without registered roots", () => {
    publishSelectionChromeForControllerState({
      fileId: "f1",
      segments: [{ uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "" }],
      primaryIdx: 0,
      selectedIndices: [0],
    });
    expect(getSelectionChromeSnapshot().version).toBe(0);
  });

  it("publishes through registered roots after structure mutation", () => {
    const listRoot = document.createElement("div");
    registerSelectionChromePublishRoots({
      getListRoot: () => listRoot,
      getOverlayRoot: () => null,
    });
    const segments = [
      { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "" },
      { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "" },
    ];
    publishSelectionChromeForControllerState({
      fileId: "f1",
      segments,
      primaryIdx: 1,
      selectedIndices: [1],
    });
    expect(getSelectionChromeSnapshot().primaryIdx).toBe(1);
  });

  it("resetSelectionChromeForFile clears store", () => {
    registerSelectionChromePublishRoots({
      getListRoot: () => null,
      getOverlayRoot: () => null,
    });
    publishSelectionChromeForControllerState({
      fileId: "f1",
      segments: [{ uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "" }],
      primaryIdx: 0,
      selectedIndices: [0],
    });
    resetSelectionChromeForFile("f2");
    expect(getSelectionChromeSnapshot().primaryIdx).toBe(-1);
    expect(getSelectionChromeSnapshot().fileId).toBe("f2");
  });
});
