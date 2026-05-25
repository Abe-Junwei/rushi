import { describe, expect, it } from "vitest";
import { flushSync } from "react-dom";
import type React from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { flushSegmentTextDrafts } from "../pages/flushSegmentTextDrafts";
import { segmentDraftKey, segmentDraftStore } from "./useSegmentDraftStore";

function seg(text: string, uid?: string): SegmentDto {
  return {
    idx: 0,
    uid: uid ?? "uid-a",
    start_sec: 0,
    end_sec: 1,
    text,
    confidence: null,
    low_confidence: false,
    detail: null,
  };
}

describe("segmentDraftStore + flushSegmentTextDrafts", () => {
  it("flushes dirty drafts into segments state", () => {
    segmentDraftStore.resetAll();
    const s = seg("old");
    const key = segmentDraftKey(s, 0);
    segmentDraftStore.setDraft(key, "draft");

    const segmentsRef: React.MutableRefObject<SegmentDto[]> = { current: [s] };
    let next: SegmentDto[] = [];
    const setSegments = (updater: React.SetStateAction<SegmentDto[]>) => {
      flushSync(() => {
        next = typeof updater === "function" ? updater(segmentsRef.current) : updater;
        segmentsRef.current = next;
      });
    };

    flushSegmentTextDrafts(segmentsRef, setSegments);

    expect(next[0]?.text).toBe("draft");
    expect(segmentDraftStore.getDraft(key)).toBeUndefined();
  });

  it("skips flush when draft matches committed text", () => {
    segmentDraftStore.resetAll();
    const s = seg("same");
    const key = segmentDraftKey(s, 0);
    segmentDraftStore.setDraft(key, "same");

    const segmentsRef: React.MutableRefObject<SegmentDto[]> = { current: [s] };
    const setSegments = () => {
      throw new Error("should not update");
    };

    flushSegmentTextDrafts(segmentsRef, setSegments);
    expect(segmentsRef.current[0]?.text).toBe("same");
  });
});
