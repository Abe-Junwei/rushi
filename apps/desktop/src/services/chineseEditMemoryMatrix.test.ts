import { describe, expect, it } from "vitest";
import { buildConfirmExplicitPairs } from "./correctionInferPair";
import {
  appendProgrammaticLearnOp,
  applyBeforeInputToLearnEditState,
  emptyLearnEditState,
} from "./learnEditDelta";
import { partitionPendingLearnChanges } from "./pendingLearnRevision";

describe("中文改词矩阵（纳入记忆）", () => {
  it("选区替换：二六十中→而六时中", () => {
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
    expect(buildConfirmExplicitPairs(baseline, live, state)).toEqual([
      { beforeText: "二六十中", afterText: "而六时中" },
    ]);
  });

  it("单字改动：其→七 仅 skipped", () => {
    const baseline = "尤其是其道场";
    const live = "尤其是七道场";
    const { learnablePairs, skipped } = partitionPendingLearnChanges(baseline, live);
    expect(learnablePairs).toEqual([]);
    expect(skipped).toEqual([
      { removed: "其", inserted: "七", reason: "single_char" },
    ]);
  });

  it("程序化替换：山通→禅宗", () => {
    const baseline = "尤其是山通道场";
    const live = "尤其是禅宗道场";
    const start = baseline.indexOf("山通");
    const state = appendProgrammaticLearnOp(emptyLearnEditState(), {
      anchor: start,
      removed: "山通",
      inserted: "禅宗",
    });
    expect(buildConfirmExplicitPairs(baseline, live, state)).toEqual([
      { beforeText: "山通", afterText: "禅宗" },
    ]);
  });

  it("程序化整词：安波那那→安那般那", () => {
    const baseline = "安波那那";
    const live = "安那般那";
    const state = appendProgrammaticLearnOp(emptyLearnEditState(), {
      anchor: 0,
      removed: "安波那那",
      inserted: "安那般那",
    });
    expect(buildConfirmExplicitPairs(baseline, live, state)).toEqual([
      { beforeText: "安波那那", afterText: "安那般那" },
    ]);
  });

  it("视死→誓死：须追踪整词对，无 diff 回退", () => {
    const baseline = "只有这种视死悟道的决心。";
    const live = "只有这种誓死悟道的决心。";
    expect(partitionPendingLearnChanges(baseline, live).learnablePairs).toEqual([]);

    const start = baseline.indexOf("视死");
    let state = emptyLearnEditState();
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      baseline,
      start,
      start + 2,
      "insertReplacementText",
      "誓死",
    );
    expect(partitionPendingLearnChanges(baseline, live, state).learnablePairs).toEqual([
      { beforeText: "视死", afterText: "誓死" },
    ]);
  });

  it("两处仅删：不计入 learnable", () => {
    const baseline = "如果这个展场里面有二十个扳手里面有二十个师傅来回。";
    const live = "如果这个里面有二十个里面有二十个师傅来回。";
    const { learnablePairs, skipped } = partitionPendingLearnChanges(baseline, live);
    expect(learnablePairs).toEqual([]);
    expect(skipped.filter((s) => s.reason === "delete_only").length).toBeGreaterThanOrEqual(2);
  });
});
