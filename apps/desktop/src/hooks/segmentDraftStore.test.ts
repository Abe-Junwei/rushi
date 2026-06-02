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

  it("resetAll clears learn focus baseline when drafts are empty", () => {
    segmentDraftStore.resetAll();
    const s = seg("脸喉");
    const key = segmentDraftKey(s, 0);
    segmentDraftStore.setLearnFocusBaseline(key, "脸喉");
    segmentDraftStore.resetAll();
    expect(segmentDraftStore.getLearnFocusBaseline(key)).toBeUndefined();
  });

  it("setLearnFocusBaseline does not overwrite existing revision baseline", () => {
    segmentDraftStore.resetAll();
    const key = segmentDraftKey(seg("a"), 0);
    segmentDraftStore.setLearnFocusBaseline(key, "我们一千年前");
    segmentDraftStore.setLearnFocusBaseline(key, "我们一天前");
    expect(segmentDraftStore.getLearnFocusBaseline(key)).toBe("我们一千年前");
  });

  it("pruneMissingKeys removes orphan learn focus baseline", () => {
    segmentDraftStore.resetAll();
    const s = seg("a");
    const key = segmentDraftKey(s, 0);
    segmentDraftStore.setLearnFocusBaseline(key, "old");
    segmentDraftStore.pruneMissingKeys(new Set());
    expect(segmentDraftStore.getLearnFocusBaseline(key)).toBeUndefined();
  });

  it("skips flush while IME composition is active", () => {
    segmentDraftStore.resetAll();
    const s = seg("脸喉");
    const key = segmentDraftKey(s, 0);
    segmentDraftStore.setDraft(key, "lian");
    segmentDraftStore.setComposing(key, true);

    const segmentsRef: React.MutableRefObject<SegmentDto[]> = { current: [s] };
    const setSegments = () => {
      throw new Error("should not update");
    };

    flushSegmentTextDrafts(segmentsRef, setSegments);
    expect(segmentsRef.current[0]?.text).toBe("脸喉");
  });
});
