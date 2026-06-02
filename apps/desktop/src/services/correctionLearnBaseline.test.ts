import { describe, expect, it, beforeEach } from "vitest";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";
import {
  buildConfirmLearnBaseline,
  needsLearnOnSegmentConfirm,
  segmentPendingLearnAtIndex,
  segmentsToLearnBaseline,
} from "./correctionLearnBaseline";

function seg(uid: string, text: string): SegmentDto {
  return { uid, idx: 0, start_sec: 0, end_sec: 1, text };
}

describe("segmentsToLearnBaseline", () => {
  it("maps uid and text, skips empty uid", () => {
    expect(segmentsToLearnBaseline([seg("u1", "旧"), seg("", "x")])).toEqual([
      { uid: "u1", text: "旧" },
    ]);
  });
});

describe("confirm learn baseline", () => {
  beforeEach(() => {
    segmentDraftStore.resetAll();
  });

  it("needsLearnOnSegmentConfirm when tracked op is learnable", () => {
    const s = seg("u1", "敛喉");
    const key = segmentDraftKey(s, 0);
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
    expect(needsLearnOnSegmentConfirm([seg("u1", "敛喉")], 0, [s])).toBe(true);
  });

  it("needsLearnOnSegmentConfirm false when only baseline differs without tracking", () => {
    const s = seg("u1", "敛喉");
    const key = segmentDraftKey(s, 0);
    segmentDraftStore.setLearnFocusBaseline(key, "脸喉");
    expect(needsLearnOnSegmentConfirm([seg("u1", "敛喉")], 0, [s])).toBe(false);
  });

  it("segmentPendingLearnAtIndex requires learnable tracked ops", () => {
    const s = seg("u9", "甲新词");
    const key = segmentDraftKey(s, 8);
    segmentDraftStore.setLearnFocusBaseline(key, "甲旧词");
    segmentDraftStore.setDraft(key, "甲新词");
    segmentDraftStore.recordProgrammaticLearnReplacement(
      key,
      "甲旧词",
      "甲旧词",
      1,
      "旧词",
      "新词",
    );
    expect(segmentPendingLearnAtIndex(s, 8)).toBe(true);
  });

  it("buildConfirmLearnBaseline uses focus baseline for confirmed segment", () => {
    const saved = [seg("u1", "敛喉")];
    const live = [seg("u1", "敛喉")];
    const key = segmentDraftKey(live[0], 0);
    segmentDraftStore.setLearnFocusBaseline(key, "脸喉");
    expect(buildConfirmLearnBaseline(saved, 0, live)).toEqual([{ uid: "u1", text: "脸喉" }]);
  });
});
