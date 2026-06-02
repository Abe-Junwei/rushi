import { describe, expect, it } from "vitest";
import { applyBeforeInputToLearnEditState, emptyLearnEditState } from "./learnEditDelta";
import { partitionPendingLearnChanges } from "./pendingLearnRevision";

describe("partitionPendingLearnChanges", () => {
  it("without tracking: diff preview only in skipped, no learnable", () => {
    const { learnablePairs, skipped } = partitionPendingLearnChanges(
      "尤其是山通道场",
      "尤其是禅宗道场",
    );
    expect(learnablePairs).toEqual([]);
    expect(skipped.length).toBeGreaterThan(0);
  });

  it("skips single-char CJK replacement in diff preview", () => {
    const { learnablePairs, skipped } = partitionPendingLearnChanges(
      "尤其是其道场",
      "尤其是七道场",
    );
    expect(learnablePairs).toEqual([]);
    expect(skipped).toEqual([
      { removed: "其", inserted: "七", reason: "single_char" },
    ]);
  });

  it("prefers beforeinput tracking for 胸襟→胸膺", () => {
    const baseline = "他有胸襟炎症";
    const start = baseline.indexOf("胸襟");
    let state = emptyLearnEditState();
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      baseline,
      start,
      start + 2,
      "deleteContentBackward",
      null,
    );
    const afterDelete = baseline.slice(0, start) + baseline.slice(start + 2);
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      afterDelete,
      start,
      start,
      "insertText",
      "胸膺",
    );
    const live = "他有胸膺炎症";
    const { learnablePairs, skipped } = partitionPendingLearnChanges(baseline, live, state);
    expect(learnablePairs).toEqual([{ beforeText: "胸襟", afterText: "胸膺" }]);
    expect(skipped).toEqual([]);
  });

  it("marks delete-only edits as skipped", () => {
    const baseline = "如果这个展场里面有二十个扳手里面有二十个师傅来回。";
    const live = "如果这个里面有二十个里面有二十个师傅来回。";
    const { learnablePairs, skipped } = partitionPendingLearnChanges(baseline, live);
    expect(learnablePairs).toEqual([]);
    expect(skipped.filter((s) => s.reason === "delete_only").length).toBeGreaterThanOrEqual(2);
  });

  it("without tracking: 二六十中→而六时中 only in skipped preview", () => {
    const { learnablePairs, skipped } = partitionPendingLearnChanges(
      "尤其在二六十中道场",
      "尤其在而六时中道场",
    );
    expect(learnablePairs).toEqual([]);
    expect(skipped.length).toBeGreaterThan(0);
  });

  it("with tracking: 二六十中→而六时中 is learnable", () => {
    const baseline = "尤其在二六十中道场";
    const live = "尤其在而六时中道场";
    const start = baseline.indexOf("二六十中");
    let state = emptyLearnEditState();
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      baseline,
      start,
      start + 4,
      "insertReplacementText",
      "而六时中",
    );
    const { learnablePairs, skipped } = partitionPendingLearnChanges(baseline, live, state);
    expect(learnablePairs).toEqual([{ beforeText: "二六十中", afterText: "而六时中" }]);
    expect(skipped).toEqual([]);
  });
});
