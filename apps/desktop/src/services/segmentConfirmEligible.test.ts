import { describe, expect, it } from "vitest";
import { segmentCanConfirmEdit, segmentHasUnsavedText } from "./segmentConfirmEligible";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";

function seg(uid: string, text: string): SegmentDto {
  return {
    uid,
    idx: 0,
    text,
    start_sec: 0,
    end_sec: 1,
    confidence: 1,
    low_confidence: false,
    detail: null,
  };
}

describe("segmentConfirmEligible", () => {
  it("detects unsaved draft text", () => {
    segmentDraftStore.resetAll();
    const rows = [seg("u1", "甲")];
    segmentDraftStore.setDraft(segmentDraftKey(rows[0], 0), "乙");
    expect(segmentHasUnsavedText(rows, rows, 0)).toBe(true);
    segmentDraftStore.clearDraft(segmentDraftKey(rows[0], 0));
  });

  it("allows keyboard confirm when text unsaved", () => {
    segmentDraftStore.resetAll();
    const rows = [seg("u1", "甲")];
    segmentDraftStore.setDraft(segmentDraftKey(rows[0], 0), "乙");
    expect(segmentCanConfirmEdit(rows, rows, 0)).toBe(true);
    segmentDraftStore.clearDraft(segmentDraftKey(rows[0], 0));
  });
});
