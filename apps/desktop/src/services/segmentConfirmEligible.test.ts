import { describe, expect, it } from "vitest";
import {
  segmentCanConfirmEdit,
  segmentHasUnsavedText,
  segmentShowConfirmLearnButton,
} from "./segmentConfirmEligible";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";

function seg(uid: string, text: string): SegmentDto {
  return { uid, idx: 0, text, start_sec: 0, end_sec: 1, confidence: 1 };
}

describe("segmentConfirmEligible", () => {
  it("detects unsaved draft text", () => {
    const rows = [seg("u1", "甲")];
    segmentDraftStore.setDraft(segmentDraftKey(rows[0], 0), "乙");
    expect(segmentHasUnsavedText(rows, rows, 0)).toBe(true);
    segmentDraftStore.clearDraft(segmentDraftKey(rows[0], 0));
  });

  it("never shows auto纳入记忆 button (use text context menu instead)", () => {
    const saved = [seg("u1", "敛喉")];
    const live = [seg("u1", "敛喉")];
    const key = segmentDraftKey(live[0], 0);
    segmentDraftStore.setLearnFocusBaseline(key, "脸喉");
    segmentDraftStore.applyLearnEditBeforeInput(
      key,
      "脸喉",
      "脸喉",
      "脸喉",
      0,
      2,
      "insertReplacementText",
      "敛喉",
    );
    expect(segmentShowConfirmLearnButton(live, saved, 0)).toBe(false);
    segmentDraftStore.clearLearnFocusBaseline(key);
    segmentDraftStore.resetLearnEditState(key);
  });

  it("allows keyboard confirm when text unsaved even without learn button", () => {
    const rows = [seg("u1", "甲")];
    segmentDraftStore.setDraft(segmentDraftKey(rows[0], 0), "乙");
    expect(segmentShowConfirmLearnButton(rows, rows, 0)).toBe(false);
    expect(segmentCanConfirmEdit(rows, rows, 0)).toBe(true);
    segmentDraftStore.clearDraft(segmentDraftKey(rows[0], 0));
  });
});
