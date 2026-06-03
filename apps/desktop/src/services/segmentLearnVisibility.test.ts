import { describe, expect, it, beforeEach } from "vitest";
import { segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";
import {
  segmentLearnButtonVisible,
  shouldRetainDraftForPendingLearn,
} from "./segmentLearnVisibility";

function seg(text: string): SegmentDto {
  return { uid: "u1", idx: 0, start_sec: 0, end_sec: 1, text };
}

describe("segmentLearnVisibility (manual memory path)", () => {
  beforeEach(() => {
    segmentDraftStore.resetAll();
  });

  it("never shows auto纳入记忆 button", () => {
    const row = seg("尤其是山通道场");
    const key = segmentDraftKey(row, 0);
    segmentDraftStore.setLearnFocusBaseline(key, row.text);
    segmentDraftStore.setDraft(key, "尤其是禅宗道场");
    expect(segmentLearnButtonVisible(key, row.text, true)).toBe(false);
    expect(shouldRetainDraftForPendingLearn(key, row.text, "尤其是禅宗道场")).toBe(false);
  });
});
