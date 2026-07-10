import { describe, expect, it } from "vitest";
import {
  segmentCanConfirmEdit,
  segmentCanFinalize,
  segmentHasTextContent,
  segmentHasUnsavedText,
} from "./segmentConfirmEligible";
import type { SegmentDto } from "../tauri/projectApi";

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
  it("detects unsaved segment text vs saved snapshot", () => {
    const live = [seg("u1", "乙")];
    const saved = [seg("u1", "甲")];
    expect(segmentHasUnsavedText(live, saved, 0)).toBe(true);
  });

  it("allows keyboard confirm when text unsaved", () => {
    const live = [seg("u1", "乙")];
    const saved = [seg("u1", "甲")];
    expect(segmentCanConfirmEdit(live, saved, 0)).toBe(true);
  });

  it("allows finalize for non-finalized segments", () => {
    const rows = [seg("u1", "甲")];
    expect(segmentCanFinalize(rows, 0, false)).toBe(true);
  });

  it("blocks finalize when already finalized", () => {
    const rows = [{ ...seg("u1", "甲"), text_stage: "finalized" as const }];
    expect(segmentCanFinalize(rows, 0, false)).toBe(false);
  });

  it("detects segment text content from segment.text", () => {
    const empty = [seg("u1", "")];
    expect(segmentHasTextContent(empty, 0)).toBe(false);
    const filled = [seg("u1", "正文")];
    expect(segmentHasTextContent(filled, 0)).toBe(true);
  });
});
