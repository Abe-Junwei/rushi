import { describe, expect, it } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import {
  applyAiRevisedStageToUids,
  applyManualTranscribeStageOnTextSave,
  applyStagePatchesBeforePersist,
  inheritSplitLeftStage,
  mergeSegmentStageFields,
  syncSegmentStagesAfterTranscribeReload,
} from "./segmentStagePersist";

function seg(text: string, uid = "u1", stage: SegmentDto["text_stage"] = "auto_transcribe"): SegmentDto {
  return {
    uid,
    idx: 0,
    start_sec: 0,
    end_sec: 1,
    text,
    low_confidence: false,
    text_stage: stage,
    finalize_via: null,
  };
}

describe("segmentStagePersist", () => {
  it("manual save on text change", () => {
    const saved = [seg("a")];
    const live = [seg("ab")];
    const out = applyManualTranscribeStageOnTextSave(live, saved);
    expect(out[0]?.text_stage).toBe("manual_transcribe");
  });

  it("does not upgrade auto_transcribe when uid missing from snapshot (re-transcribe)", () => {
    const saved = [seg("old text", "old-uid")];
    const live = [seg("new asr text", "new-uid", "auto_transcribe")];
    const out = applyManualTranscribeStageOnTextSave(live, saved);
    expect(out[0]?.text_stage).toBe("auto_transcribe");
  });

  it("keeps manual_transcribe for new uid user segment without snapshot row", () => {
    const saved = [seg("a", "u1")];
    const live = [seg("a", "u1"), seg("hand typed", "u2", "manual_transcribe")];
    const out = applyManualTranscribeStageOnTextSave(live, saved);
    expect(out[1]?.text_stage).toBe("manual_transcribe");
  });

  it("syncSegmentStagesAfterTranscribeReload resets all stages", () => {
    const rows = [
      seg("a", "u1", "manual_transcribe"),
      seg("b", "u2", "finalized"),
    ];
    const out = syncSegmentStagesAfterTranscribeReload(rows);
    expect(out.every((s) => s.text_stage === "auto_transcribe")).toBe(true);
    expect(out.every((s) => s.finalize_via === null)).toBe(true);
  });

  it("finalize with draft uses confirm_edit", () => {
    const saved = [seg("a")];
    const live = [seg("ab", "u1", "ai_revised")];
    const out = applyStagePatchesBeforePersist(live, saved, {
      segmentIdx: 0,
      hadUnsavedDraft: true,
    });
    expect(out[0]?.text_stage).toBe("finalized");
    expect(out[0]?.finalize_via).toBe("confirm_edit");
  });

  it("finalize without draft uses mark_only", () => {
    const saved = [seg("a", "u1", "ai_revised")];
    const live = [seg("a", "u1", "ai_revised")];
    const out = applyStagePatchesBeforePersist(live, saved, {
      segmentIdx: 0,
      hadUnsavedDraft: false,
    });
    expect(out[0]?.finalize_via).toBe("mark_only");
  });

  it("llm writeback keeps ai_revised after manual pass on save", () => {
    const saved = [seg("old", "u1")];
    const live = [seg("new", "u1", "ai_revised")];
    const out = applyStagePatchesBeforePersist(live, saved, {
      aiRevisedUids: new Set(["u1"]),
    });
    expect(out[0]?.text_stage).toBe("ai_revised");
  });

  it("ai revised uids", () => {
    const rows = [seg("x", "u1"), seg("y", "u2")];
    const out = applyAiRevisedStageToUids(rows, new Set(["u2"]));
    expect(out[0]?.text_stage).toBe("auto_transcribe");
    expect(out[1]?.text_stage).toBe("ai_revised");
  });

  it("mergeSegmentStageFields picks the least confirmed stage", () => {
    const fields = mergeSegmentStageFields(
      seg("a", "u1", "finalized"),
      seg("b", "u2", "ai_revised"),
    );
    expect(fields.text_stage).toBe("ai_revised");
    expect(fields.finalize_via).toBeNull();
  });

  it("inheritSplitLeftStage preserves finalized parent", () => {
    const fields = inheritSplitLeftStage({
      ...seg("a", "u1", "finalized"),
      finalize_via: "mark_only",
    });
    expect(fields.text_stage).toBe("finalized");
    expect(fields.finalize_via).toBe("mark_only");
  });
});
