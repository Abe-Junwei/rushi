import { describe, expect, it } from "vitest";
import {
  applyBeforeInputToLearnEditState,
  applyInputEventToLearnEditState,
  applyLearnEditOpsToText,
  captureTextDeletedByBeforeInput,
  collectLearnablePairsForSession,
  emptyLearnEditState,
  explicitPairsFromLearnEditState,
  finalizeLearnEditAfterComposition,
  learnEditStateMatchesLive,
  syncLearnEditStateToBaselineLive,
} from "./learnEditDelta";

describe("learnEditDelta", () => {
  it("tracks selection delete then insert as 一千→一天", () => {
    const baseline = "我们一千年前";
    let state = emptyLearnEditState();
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      baseline,
      2,
      4,
      "deleteContentBackward",
      null,
    );
    expect(state.ops[0]).toEqual({ anchor: 2, removed: "一千", inserted: "" });

    const live = "我们一天年前";
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      live,
      2,
      2,
      "insertText",
      "一天",
    );
    expect(state.ops[0]).toEqual({ anchor: 2, removed: "一千", inserted: "一天" });
    expect(learnEditStateMatchesLive(state, baseline, live)).toBe(true);
    expect(explicitPairsFromLearnEditState(state, baseline, live)).toEqual([
      { beforeText: "一千", afterText: "一天" },
    ]);
  });

  it("tracks 胸襟→胸膺 as whole words (not 襟→膺)", () => {
    const baseline = "他有胸襟炎症";
    let state = emptyLearnEditState();
    const start = baseline.indexOf("胸襟");
    const end = start + 2;
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      baseline,
      start,
      end,
      "deleteContentBackward",
      null,
    );
    expect(state.ops[0]?.removed).toBe("胸襟");

    const afterDelete = baseline.slice(0, start) + baseline.slice(end);
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      afterDelete,
      start,
      start,
      "insertCompositionText",
      "胸膺",
    );
    const live = applyLearnEditOpsToText(baseline, state.ops);
    expect(live).toBe("他有胸膺炎症");
    expect(explicitPairsFromLearnEditState(state, baseline, live)).toEqual([
      { beforeText: "胸襟", afterText: "胸膺" },
    ]);
  });

  it("keeps disjoint deletions as separate ops", () => {
    const baseline = "如果这个展场里面有二十个扳手里面有二十个师傅来回。";
    let state = emptyLearnEditState();
    const a = baseline.indexOf("展场");
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      baseline,
      a,
      a + 2,
      "deleteContentBackward",
      null,
    );
    let live = applyLearnEditOpsToText(baseline, state.ops);
    const b = live.indexOf("扳手");
    state = applyBeforeInputToLearnEditState(state, baseline, live, b, b + 2, "deleteContentBackward", null);
    expect(state.ops).toHaveLength(2);
    expect(state.ops[0]?.removed).toBe("展场");
    expect(state.ops[1]?.removed).toBe("扳手");
  });

  it("captureTextDeletedByBeforeInput uses selection range", () => {
    expect(
      captureTextDeletedByBeforeInput("我们一千年前", 2, 4, "deleteContentBackward"),
    ).toBe("一千");
  });

  it("tracks insertReplacementText as 二六十中→而六时中", () => {
    const baseline = "尤其在二六十中道场";
    const live = "尤其在而六时中道场";
    const start = baseline.indexOf("二六十中");
    const end = start + 4;
    let state = emptyLearnEditState();
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      baseline,
      start,
      end,
      "insertReplacementText",
      "而六时中",
    );
    expect(state.ops[0]).toEqual({ anchor: start, removed: "二六十中", inserted: "而六时中" });
    expect(explicitPairsFromLearnEditState(state, baseline, live)).toEqual([
      { beforeText: "二六十中", afterText: "而六时中" },
    ]);
  });

  it("tracks insertText with selection as full phrase replace", () => {
    const baseline = "还有的同学在外面不在新台,";
    const live = "还有的同学在外面不戴胸牌,";
    const start = baseline.indexOf("不在新台");
    const end = start + 4;
    let state = emptyLearnEditState();
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      baseline,
      start,
      end,
      "insertText",
      "不戴胸牌",
    );
    expect(state.ops[0]).toEqual({ anchor: start, removed: "不在新台", inserted: "不戴胸牌" });
    expect(explicitPairsFromLearnEditState(state, baseline, live)).toEqual([
      { beforeText: "不在新台", afterText: "不戴胸牌" },
    ]);
  });

  it("finalizeLearnEditAfterComposition fills removed from pending selection", () => {
    const baseline = "还有的同学在外面不在新台,";
    const start = baseline.indexOf("不在新台");
    const pending = { liveAnchor: start, removed: "不在新台" };
    let state = emptyLearnEditState();
    state = {
      ops: [{ anchor: start, removed: "", inserted: "不戴胸牌" }],
      activeIndex: 0,
    };
    state = finalizeLearnEditAfterComposition(state, pending);
    expect(state.activeIndex).toBeNull();
    expect(state.ops[0]).toEqual({
      anchor: start,
      removed: "不在新台",
      inserted: "不戴胸牌",
    });
    const live = "还有的同学在外面不戴胸牌,";
    expect(explicitPairsFromLearnEditState(state, baseline, live)).toEqual([
      { beforeText: "不在新台", afterText: "不戴胸牌" },
    ]);
  });

  it("tracks IME: composition pending + insertCompositionText", () => {
    const baseline = "还有的同学在外面不在新台,";
    const live = "还有的同学在外面不戴胸牌,";
    const start = baseline.indexOf("不在新台");
    const end = start + 4;
    const afterDelete = baseline.slice(0, start) + baseline.slice(end);
    let state = emptyLearnEditState();
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      baseline,
      start,
      end,
      "deleteContentBackward",
      null,
    );
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      afterDelete,
      start,
      start,
      "insertCompositionText",
      "不戴胸牌",
    );
    state = finalizeLearnEditAfterComposition(state, null);
    expect(explicitPairsFromLearnEditState(state, baseline, live)).toEqual([
      { beforeText: "不在新台", afterText: "不戴胸牌" },
    ]);
  });

  it("deleteWordBackward on CJK falls back to single char", () => {
    const text = "尤其在二六十中道场";
    const pos = text.indexOf("中") + 1;
    expect(captureTextDeletedByBeforeInput(text, pos, pos, "deleteWordBackward")).toBe("中");
  });

  it("tracks selection delete then insert as 二六十中→而六时中", () => {
    const baseline = "尤其在二六十中道场";
    const live = "尤其在而六时中道场";
    const start = baseline.indexOf("二六十中");
    const end = start + 4;
    let state = emptyLearnEditState();
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      baseline,
      start,
      end,
      "deleteContentBackward",
      null,
    );
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      afterDel,
      start,
      start,
      "insertText",
      "而六时中",
    );
    expect(explicitPairsFromLearnEditState(state, baseline, live)).toEqual([
      { beforeText: "二六十中", afterText: "而六时中" },
    ]);
  });

  it("applyInputEventToLearnEditState: select-delete then type (empty inputType WebView)", () => {
    const baseline = "尤其是山通道场";
    const live = "尤其是禅宗道场";
    const start = baseline.indexOf("山通");
    const end = start + 2;
    let state = emptyLearnEditState();
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    state = applyInputEventToLearnEditState(state, baseline, baseline, start, end, afterDel);
    state = applyInputEventToLearnEditState(state, baseline, afterDel, start, start, live);
    expect(explicitPairsFromLearnEditState(state, baseline, live)).toEqual([
      { beforeText: "山通", afterText: "禅宗" },
    ]);
  });

  it("applyInputEventToLearnEditState: backspace then type char-by-char", () => {
    const baseline = "他有胸襟炎症";
    const start = baseline.indexOf("胸襟");
    const end = start + 2;
    let state = emptyLearnEditState();
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    state = applyInputEventToLearnEditState(state, baseline, baseline, start, end, afterDel);
    state = applyInputEventToLearnEditState(state, baseline, afterDel, start, start, "他有胸膺炎症");
    expect(explicitPairsFromLearnEditState(state, baseline, "他有胸膺炎症")).toEqual([
      { beforeText: "胸襟", afterText: "胸膺" },
    ]);
  });

  it("delete then insert with stale selection on second step", () => {
    const baseline = "只有这种视死悟道的决心。";
    const live = "只有这种誓死悟道的决心。";
    const start = baseline.indexOf("视死");
    const end = start + 2;
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    let state = emptyLearnEditState();
    state = applyInputEventToLearnEditState(state, baseline, baseline, start, end, afterDel);
    state = applyInputEventToLearnEditState(state, baseline, afterDel, 0, 0, live);
    expect(explicitPairsFromLearnEditState(state, baseline, live)).toEqual([
      { beforeText: "视死", afterText: "誓死" },
    ]);
  });

  it("finalizeLearnEditAfterComposition keeps active op after delete-only (IME follows)", () => {
    const baseline = "只有这种视死悟道的决心。";
    const live = "只有这种誓死悟道的决心。";
    const start = baseline.indexOf("视死");
    const end = start + 2;
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    let state = emptyLearnEditState();
    state = applyInputEventToLearnEditState(state, baseline, baseline, start, end, afterDel);
    state = finalizeLearnEditAfterComposition(state, null);
    expect(state.activeIndex).toBe(0);
    expect(state.ops[0]).toEqual({ anchor: start, removed: "视死", inserted: "" });
    state = applyInputEventToLearnEditState(state, baseline, afterDel, start, start, live);
    expect(explicitPairsFromLearnEditState(state, baseline, live)).toEqual([
      { beforeText: "视死", afterText: "誓死" },
    ]);
  });

  it("trim inserted when deleting within new word (active op)", () => {
    const baseline = "只有这种视死悟道的决心。";
    const live1 = "只有这种誓死悟道的决心。";
    const live2 = "只有这种誓悟道的决心。";
    const start = baseline.indexOf("视死");
    const end = start + 2;
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    let state = emptyLearnEditState();
    state = applyInputEventToLearnEditState(state, baseline, baseline, start, end, afterDel);
    state = applyInputEventToLearnEditState(state, baseline, afterDel, start, start, live1);
    expect(state.activeIndex).toBe(0);
    const pos = live1.indexOf("死") + 1;
    state = applyInputEventToLearnEditState(state, baseline, live1, pos, pos, live2);
    expect(state.ops[0]).toEqual({ anchor: start, removed: "视死", inserted: "誓" });
    expect(learnEditStateMatchesLive(state, baseline, live2)).toBe(true);
    expect(explicitPairsFromLearnEditState(state, baseline, live2)).toEqual([
      { beforeText: "视死", afterText: "誓" },
    ]);
  });

  it("trim inserted when deleting within new word (finalized op)", () => {
    const baseline = "只有这种视死悟道的决心。";
    const live1 = "只有这种誓死悟道的决心。";
    const live2 = "只有这种誓悟道的决心。";
    const start = baseline.indexOf("视死");
    const end = start + 2;
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    let state = emptyLearnEditState();
    state = applyInputEventToLearnEditState(state, baseline, baseline, start, end, afterDel);
    state = applyInputEventToLearnEditState(state, baseline, afterDel, start, start, live1);
    state = { ops: state.ops, activeIndex: null };
    const pos = live1.indexOf("死") + 1;
    state = applyInputEventToLearnEditState(state, baseline, live1, pos, pos, live2);
    expect(state.ops).toHaveLength(1);
    expect(state.ops[0]).toEqual({ anchor: start, removed: "视死", inserted: "誓" });
    expect(explicitPairsFromLearnEditState(state, baseline, live2)).toEqual([
      { beforeText: "视死", afterText: "誓" },
    ]);
  });

  it("premature finalize splits delete+insert into broken twin ops (regression)", () => {
    const baseline = "只有这种视死悟道的决心。";
    const live = "只有这种誓死悟道的决心。";
    const start = baseline.indexOf("视死");
    const end = start + 2;
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    let state = emptyLearnEditState();
    state = applyInputEventToLearnEditState(state, baseline, baseline, start, end, afterDel);
    state = { ops: state.ops, activeIndex: null };
    state = applyInputEventToLearnEditState(state, baseline, afterDel, start, start, live);
    expect(learnEditStateMatchesLive(state, baseline, live)).toBe(false);
    expect(explicitPairsFromLearnEditState(state, baseline, live)).toEqual([]);
    state = syncLearnEditStateToBaselineLive(baseline, live, state);
    expect(state.ops).toEqual([{ anchor: start, removed: "视死", inserted: "誓死" }]);
    expect(learnEditStateMatchesLive(state, baseline, live)).toBe(true);
    expect(explicitPairsFromLearnEditState(state, baseline, live)).toEqual([
      { beforeText: "视死", afterText: "誓死" },
    ]);
  });

  it("syncLearnEditStateToBaselineLive: delete 视死 then type 誓死", () => {
    const baseline = "只有这种视死悟道的决心。";
    const live = "只有这种誓死悟道的决心。";
    const start = baseline.indexOf("视死");
    const end = start + 2;
    const afterDel = baseline.slice(0, start) + baseline.slice(end);
    let state = emptyLearnEditState();
    state = syncLearnEditStateToBaselineLive(
      baseline,
      afterDel,
      applyInputEventToLearnEditState(state, baseline, baseline, start, end, afterDel),
    );
    state = syncLearnEditStateToBaselineLive(
      baseline,
      live,
      applyInputEventToLearnEditState(state, baseline, afterDel, start, start, live),
    );
    expect(collectLearnablePairsForSession(state, baseline, live)).toEqual([
      { beforeText: "视死", afterText: "誓死" },
    ]);
  });
});
