import { describe, expect, it } from "vitest";
import { flushSync } from "react-dom";
import type React from "react";
import type { SegmentDto } from "../tauri/p1Api";
import { flushSegmentTextDraftsFromDom } from "./flushSegmentTextDrafts";

function seg(text: string): SegmentDto {
  return {
    idx: 0,
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
  };
}

describe("flushSegmentTextDraftsFromDom", () => {
  it("reads inputs scoped to listRoot and updates segments", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const row0 = document.createElement("div");
    row0.setAttribute("data-p1-seg-row", "0");
    const input0 = document.createElement("input");
    input0.className = "p1-seg-text";
    input0.value = "draft";
    row0.appendChild(input0);
    root.appendChild(row0);

    const decoy = document.createElement("div");
    decoy.setAttribute("data-p1-seg-row", "0");
    const decoyInput = document.createElement("input");
    decoyInput.className = "p1-seg-text";
    decoyInput.value = "wrong";
    decoy.appendChild(decoyInput);
    document.body.appendChild(decoy);

    const segmentsRef: React.MutableRefObject<SegmentDto[]> = { current: [seg("old")] };

    let next: SegmentDto[] = [];
    const setSegments = (updater: React.SetStateAction<SegmentDto[]>) => {
      flushSync(() => {
        next = typeof updater === "function" ? updater(segmentsRef.current) : updater;
        segmentsRef.current = next;
      });
    };

    flushSegmentTextDraftsFromDom(segmentsRef, setSegments, root);

    expect(next[0]?.text).toBe("draft");

    document.body.removeChild(root);
    document.body.removeChild(decoy);
  });

  it("falls back to document when listRoot is omitted", () => {
    const row = document.createElement("div");
    row.setAttribute("data-p1-seg-row", "0");
    const input = document.createElement("input");
    input.className = "p1-seg-text";
    input.value = "from-doc";
    row.appendChild(input);
    document.body.appendChild(row);

    const segmentsRef: React.MutableRefObject<SegmentDto[]> = { current: [seg("x")] };

    let next: SegmentDto[] = [];
    const setSegments = (updater: React.SetStateAction<SegmentDto[]>) => {
      flushSync(() => {
        next = typeof updater === "function" ? updater(segmentsRef.current) : updater;
        segmentsRef.current = next;
      });
    };

    flushSegmentTextDraftsFromDom(segmentsRef, setSegments);

    expect(next[0]?.text).toBe("from-doc");
    document.body.removeChild(row);
  });
});
