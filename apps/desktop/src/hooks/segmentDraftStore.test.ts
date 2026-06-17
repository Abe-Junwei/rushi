import { flushSync } from "react-dom";
import type React from "react";
import { describe, expect, it } from "vitest";
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
    segmentDraftStore.flushPendingEmit();

    let reactState: SegmentDto[] = [s];
    let next: SegmentDto[] = [];
    const getCurrentSegmentsSnapshot = () => reactState;
    const setSegments = (updater: React.SetStateAction<SegmentDto[]>) => {
      flushSync(() => {
        next = typeof updater === "function" ? updater(reactState) : updater;
        reactState = next;
      });
    };

    flushSegmentTextDrafts(getCurrentSegmentsSnapshot, setSegments);

    expect(next[0]?.text).toBe("draft");
    expect(segmentDraftStore.getDraft(key)).toBeUndefined();
  });

  it("skips flush when draft matches committed text", () => {
    segmentDraftStore.resetAll();
    const s = seg("same");
    const key = segmentDraftKey(s, 0);
    segmentDraftStore.setDraft(key, "same");
    segmentDraftStore.flushPendingEmit();

    let reactState: SegmentDto[] = [s];
    const getCurrentSegmentsSnapshot = () => reactState;
    const setSegments = () => {
      throw new Error("should not update");
    };

    flushSegmentTextDrafts(getCurrentSegmentsSnapshot, setSegments);
    expect(reactState[0]?.text).toBe("same");
  });

  it("flushes IME composition when merge/save ends composition first", () => {
    segmentDraftStore.resetAll();
    const s = seg("脸喉");
    const key = segmentDraftKey(s, 0);
    segmentDraftStore.setDraft(key, "lian");
    segmentDraftStore.setComposing(key, true);
    segmentDraftStore.flushPendingEmit();

    let reactState: SegmentDto[] = [s];
    let next: SegmentDto[] = [];
    const getCurrentSegmentsSnapshot = () => reactState;
    const setSegments = (updater: React.SetStateAction<SegmentDto[]>) => {
      flushSync(() => {
        next = typeof updater === "function" ? updater(reactState) : updater;
        reactState = next;
      });
    };

    flushSegmentTextDrafts(getCurrentSegmentsSnapshot, setSegments);
    expect(next[0]?.text).toBe("lian");
    expect(segmentDraftStore.isComposing(key)).toBe(false);
  });
});
