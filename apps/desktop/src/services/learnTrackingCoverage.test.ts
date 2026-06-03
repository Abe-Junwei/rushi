import { describe, expect, it, beforeEach } from "vitest";
import { segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";
import type { SegmentDto } from "../tauri/projectApi";
import { applySegmentTextLearnMeta } from "../pages/segmentTextLearnMeta";
import { partitionPendingLearnChanges } from "./pendingLearnRevision";

const seg = (text: string, uid = "u1"): SegmentDto => ({
  uid,
  text,
  start_sec: 0,
  end_sec: 1,
  idx: 0,
});

describe("learn tracking coverage", () => {
  beforeEach(() => {
    segmentDraftStore.resetAll();
  });

  it("recordProgrammaticLearnReplacement: 山通→禅宗", () => {
    const row = seg("尤其是山通道场");
    const key = segmentDraftKey(row, 0);
    segmentDraftStore.recordProgrammaticLearnReplacement(
      key,
      row.text,
      row.text,
      row.text.indexOf("山通"),
      "山通",
      "禅宗",
    );
    const live = "尤其是禅宗道场";
    const { learnablePairs } = partitionPendingLearnChanges(row.text, live, segmentDraftStore.getLearnEditState(key));
    expect(learnablePairs).toEqual([{ beforeText: "山通", afterText: "禅宗" }]);
  });

  it("applySegmentTextLearnMeta via popover shape", () => {
    const row = seg("还有的同学在外面不在新台,");
    const liveBase = row.text;
    const start = liveBase.indexOf("不在新台");
    applySegmentTextLearnMeta(row, 0, {
      committedText: row.text,
      liveTextBeforeEdit: liveBase,
      liveAnchor: start,
      removed: "不在新台",
      inserted: "不戴胸牌",
    });
    const key = segmentDraftKey(row, 0);
    const live = "还有的同学在外面不戴胸牌,";
    const { learnablePairs } = partitionPendingLearnChanges(row.text, live, segmentDraftStore.getLearnEditState(key));
    expect(learnablePairs).toEqual([{ beforeText: "不在新台", afterText: "不戴胸牌" }]);
  });

  it("ensureLearnFocusBaseline on first beforeinput path", () => {
    const row = seg("脸喉发炎");
    const key = segmentDraftKey(row, 0);
    segmentDraftStore.applyLearnEditBeforeInput(
      key,
      row.text,
      row.text,
      row.text,
      0,
      2,
      "insertReplacementText",
      "敛喉",
    );
    expect(segmentDraftStore.getLearnFocusBaseline(key)).toBe("脸喉发炎");
    const live = "敛喉发炎";
    const { learnablePairs } = partitionPendingLearnChanges(
      row.text,
      live,
      segmentDraftStore.getLearnEditState(key),
    );
    expect(learnablePairs).toEqual([{ beforeText: "脸喉", afterText: "敛喉" }]);
  });

  it("beginComposition + endComposition fills removed for IME insert", () => {
    const row = seg("还有的同学在外面不在新台,");
    const key = segmentDraftKey(row, 0);
    const start = row.text.indexOf("不在新台");
    const end = start + 4;
    const afterDelete = row.text.slice(0, start) + row.text.slice(end);
    segmentDraftStore.beginComposition(key);
    segmentDraftStore.applyLearnEditBeforeInput(
      key,
      row.text,
      row.text,
      afterDelete,
      start,
      start,
      "insertCompositionText",
      "不戴胸牌",
    );
    segmentDraftStore.endComposition(key);
    const live = "还有的同学在外面不戴胸牌,";
    const { learnablePairs } = partitionPendingLearnChanges(
      row.text,
      live,
      segmentDraftStore.getLearnEditState(key),
    );
    expect(learnablePairs).toEqual([{ beforeText: "在新台", afterText: "戴胸牌" }]);
  });
});
