// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { SEGMENT_FILL_CSS_VAR } from "../../config/segmentFillTokens";
import { readCspLayoutRulesForElement } from "../../utils/cspElementLayout";
import { applySelectionChromeImperative } from "./applySelectionChromeImperative";

describe("applySelectionChromeImperative", () => {
  it("toggles list row chrome imperatively for mounted rows", () => {
    const listRoot = document.createElement("div");

    const prevRow = document.createElement("div");
    prevRow.setAttribute("data-seg-row", "1");
    prevRow.className = "seg-row-shell seg-row-selected";

    const nextRow = document.createElement("div");
    nextRow.setAttribute("data-seg-row", "2");
    nextRow.className = "seg-row-shell";

    listRoot.append(prevRow, nextRow);

    const segments = [
      { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "" },
      { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "" },
      { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "" },
    ];

    applySelectionChromeImperative({
      overlayRoot: null,
      listRoot,
      segments,
      prevSnapshot: {
        primaryIdx: 1,
        selectedSet: new Set([1]),
        version: 0,
        fileId: "f1",
      },
      nextSnapshot: {
        primaryIdx: 2,
        selectedSet: new Set([2]),
        version: 1,
        fileId: "f1",
      },
    });

    expect(prevRow.classList.contains("seg-row-selected")).toBe(false);
    expect(nextRow.classList.contains("seg-row-selected")).toBe(true);
  });

  it("toggles waveform overlay chrome without mutating child handles", () => {
    const overlayRoot = document.createElement("div");

    const prevOverlay = document.createElement("div");
    prevOverlay.setAttribute("data-segment-idx", "1");
    prevOverlay.className = "waveform-segment-region waveform-segment-region-selected";
    const prevHandle = document.createElement("span");
    prevHandle.className = "waveform-segment-handle waveform-segment-handle-start";
    prevOverlay.append(prevHandle);

    const nextOverlay = document.createElement("div");
    nextOverlay.setAttribute("data-segment-idx", "2");
    nextOverlay.className = "waveform-segment-region";

    overlayRoot.append(prevOverlay, nextOverlay);

    const segments = [
      { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "" },
      { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "" },
      { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "" },
    ];

    applySelectionChromeImperative({
      overlayRoot,
      listRoot: null,
      segments,
      prevSnapshot: {
        primaryIdx: 1,
        selectedSet: new Set([1]),
        version: 0,
        fileId: "f1",
      },
      nextSnapshot: {
        primaryIdx: 2,
        selectedSet: new Set([2]),
        version: 1,
        fileId: "f1",
      },
    });

    expect(prevOverlay.classList.contains("waveform-segment-region-selected")).toBe(false);
    expect(prevOverlay.contains(prevHandle)).toBe(true);
    expect(nextOverlay.classList.contains("waveform-segment-region-selected")).toBe(true);
  });

  it("uses inSelection waveform fill for all rows when multi-select is active", () => {
    const overlayRoot = document.createElement("div");
    const primaryOverlay = document.createElement("div");
    primaryOverlay.setAttribute("data-segment-idx", "4");
    const secondaryOverlay = document.createElement("div");
    secondaryOverlay.setAttribute("data-segment-idx", "2");
    overlayRoot.append(primaryOverlay, secondaryOverlay);

    const segments = Array.from({ length: 6 }, (_, idx) => ({
      uid: `s${idx}`,
      idx,
      start_sec: idx,
      end_sec: idx + 1,
      text: "",
    }));

    applySelectionChromeImperative({
      overlayRoot,
      listRoot: null,
      segments,
      prevSnapshot: {
        primaryIdx: -1,
        selectedSet: new Set<number>(),
        version: 0,
        fileId: "f1",
      },
      nextSnapshot: {
        primaryIdx: 4,
        selectedSet: new Set([2, 4]),
        version: 1,
        fileId: "f1",
      },
    });

    const primaryBg = readCspLayoutRulesForElement(primaryOverlay) ?? "";
    const secondaryBg = readCspLayoutRulesForElement(secondaryOverlay) ?? "";
    expect(primaryBg).toContain("background:");
    expect(secondaryBg).toContain("background:");
    expect(primaryBg.split("{")[1]).toBe(secondaryBg.split("{")[1]);
    expect(primaryBg).not.toContain(`var(${SEGMENT_FILL_CSS_VAR.selected})`);
  });
});
