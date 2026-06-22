// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { TranscriptionLayerInput } from "../../pages/transcriptionLayerTypes";
import { getSelectionChromeSnapshot } from "./selectionChromeStore";
import { publishSelectionChromeForIndices } from "./publishSelectionChromeForInput";
import { publishSelectionChrome } from "./publishSelectionChrome";

describe("publishSelectionChromeForIndices", () => {
  it("commits multi-select before React updates", () => {
    const listRoot = document.createElement("div");
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "3");
    row.className = "seg-row-shell bg-transparent";
    listRoot.append(row);

    const ctx = {
      fileId: "f1",
      segments: Array.from({ length: 5 }, (_, idx) => ({
        uid: `s-${idx}`,
        idx,
        start_sec: idx,
        end_sec: idx + 1,
        text: "",
      })),
    } as unknown as TranscriptionLayerInput;

    publishSelectionChromeForIndices(ctx, [1, 2, 3], 3, { listRoot, overlayRoot: null });
    expect(getSelectionChromeSnapshot().primaryIdx).toBe(3);
    expect(getSelectionChromeSnapshot().selectedSet.has(2)).toBe(true);
    expect(getSelectionChromeSnapshot().selectedSet.has(3)).toBe(true);
  });
});

describe("publishSelectionChrome skipImperative", () => {
  it("commits store without imperative DOM updates", () => {
    const overlayRoot = document.createElement("div");
    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "2");
    row.className = "seg-row-shell";
    overlayRoot.append(row);

    const segments = Array.from({ length: 5 }, (_, idx) => ({
      uid: `s-${idx}`,
      idx,
      start_sec: idx,
      end_sec: idx + 1,
      text: "",
    }));

    publishSelectionChrome({
      fileId: "f1",
      segments,
      primaryIdx: 2,
      selectedSet: new Set([2]),
      listRoot: null,
      overlayRoot,
      skipImperative: true,
      skipBandPaint: true,
    });

    expect(getSelectionChromeSnapshot().primaryIdx).toBe(2);
    expect(row.classList.contains("seg-row-selected")).toBe(false);
  });
});
