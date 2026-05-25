import { describe, expect, it } from "vitest";
import { segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentsWithDraftsApplied } from "./segmentDirtyRead";
import { segmentsEqualForPersist } from "./segmentListHelpers";

function seg(text: string): SegmentDto {
  return { idx: 0, start_sec: 0, end_sec: 1, text };
}

describe("segmentsWithDraftsApplied", () => {
  it("applies draft text without React state", () => {
    segmentDraftStore.resetAll();
    const s = seg("committed");
    segmentDraftStore.setDraft(segmentDraftKey(s, 0), "draft-only");
    const applied = segmentsWithDraftsApplied([s]);
    expect(applied[0]?.text).toBe("draft-only");
    expect(segmentsEqualForPersist([s], applied)).toBe(false);
    segmentDraftStore.resetAll();
  });
});
