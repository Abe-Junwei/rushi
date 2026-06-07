import { describe, expect, it } from "vitest";
import {
  leastConfirmedSegmentStage,
  newUserCreatedSegment,
  normalizeSegmentFinalizeVia,
  normalizeSegmentTextStage,
  resolveSegmentStageLabels,
} from "./segmentTextStage";

describe("segmentTextStage", () => {
  it("normalizes unknown stage to auto_transcribe", () => {
    expect(normalizeSegmentTextStage(undefined)).toBe("auto_transcribe");
    expect(normalizeSegmentTextStage("bogus")).toBe("auto_transcribe");
  });

  it("resolveSegmentStageLabels for finalized confirm_edit", () => {
    const labels = resolveSegmentStageLabels("finalized", "confirm_edit");
    expect(labels.category).toBe("定稿");
    expect(labels.tooltip).toContain("确认改词");
  });

  it("resolveSegmentStageLabels for finalized mark_only", () => {
    const labels = resolveSegmentStageLabels("finalized", "mark_only");
    expect(labels.tooltip).toContain("标记认可");
  });

  it("normalizeSegmentFinalizeVia", () => {
    expect(normalizeSegmentFinalizeVia("mark_only")).toBe("mark_only");
    expect(normalizeSegmentFinalizeVia(null)).toBeNull();
  });

  it("leastConfirmedSegmentStage picks the less confirmed stage", () => {
    expect(leastConfirmedSegmentStage("finalized", "auto_transcribe")).toBe("auto_transcribe");
    expect(leastConfirmedSegmentStage("manual_transcribe", "ai_revised")).toBe("ai_revised");
  });

  it("newUserCreatedSegment defaults to manual_transcribe", () => {
    const row = newUserCreatedSegment({ uid: "u1", idx: 0, start_sec: 0, end_sec: 1, text: "" });
    expect(row.text_stage).toBe("manual_transcribe");
    expect(row.finalize_via).toBeNull();
  });
});
