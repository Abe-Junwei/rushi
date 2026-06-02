/**
 * 纳入记忆按钮 / learnEditState 边界矩阵（回归护栏）。
 * 失败项 = 已知限制或待修；通过项 = 当前引擎应保持稳定。
 */
import { describe, expect, it } from "vitest";
import {
  applyBeforeInputToLearnEditState,
  applyInputEventToLearnEditState,
  emptyLearnEditState,
  explicitPairsFromLearnEditState,
  learnEditStateMatchesLive,
  syncLearnEditStateToBaselineLive,
} from "./learnEditDelta";
import { partitionPendingLearnChanges } from "./pendingLearnRevision";

function hasLearnablePair(baseline: string, live: string, state: ReturnType<typeof emptyLearnEditState>) {
  return (
    learnEditStateMatchesLive(state, baseline, live) &&
    explicitPairsFromLearnEditState(state, baseline, live).length > 0
  );
}

describe("learnEdit edge cases matrix", () => {
  it("PASS: 删后 IME / 删后键入", () => {
    const baseline = "只有这种视死悟道的决心。";
    const live = "只有这种誓死悟道的决心。";
    const start = baseline.indexOf("视死");
    const afterDel = baseline.slice(0, start) + baseline.slice(start + 2);
    let state = applyInputEventToLearnEditState(emptyLearnEditState(), baseline, baseline, start, start + 2, afterDel);
    state = applyInputEventToLearnEditState(state, baseline, afterDel, start, start, live);
    expect(hasLearnablePair(baseline, live, state)).toBe(true);
  });

  it("PASS: 新词内部删字 / 追加", () => {
    const baseline = "只有这种视死悟道的决心。";
    const start = baseline.indexOf("视死");
    const afterDel = baseline.slice(0, start) + baseline.slice(start + 2);
    let state = applyInputEventToLearnEditState(emptyLearnEditState(), baseline, baseline, start, start + 2, afterDel);
    state = applyInputEventToLearnEditState(state, baseline, afterDel, start, start, "只有这种誓死悟道的决心。");
    const live2 = "只有这种誓悟道的决心。";
    state = applyInputEventToLearnEditState(
      state,
      baseline,
      "只有这种誓死悟道的决心。",
      live2.indexOf("死") + 1,
      live2.indexOf("死") + 1,
      live2,
    );
    expect(state.ops[0]?.inserted).toBe("誓");
    expect(hasLearnablePair(baseline, live2, state)).toBe(true);

    const live3 = "只有这种誓死吧悟道的决心。";
    state = applyInputEventToLearnEditState(
      state,
      baseline,
      live2,
      live2.indexOf("誓") + 2,
      live2.indexOf("誓") + 2,
      live3,
    );
    expect(state.ops[0]?.inserted).toBe("誓死吧");
    expect(hasLearnablePair(baseline, live3, state)).toBe(true);
  });

  it("PASS: 选区+paste / 两处不相邻改词", () => {
    const b = "尤其是山通道场";
    const st = applyBeforeInputToLearnEditState(emptyLearnEditState(), b, b, b.indexOf("山通"), b.indexOf("山通") + 2, "insertFromPaste", "禅宗");
    expect(hasLearnablePair(b, "尤其是禅宗道场", st)).toBe(true);

    const b2 = "如果这个展场里面有二十个扳手。";
    const live2 = "如果这个会场里面有二十个钳子。";
    let st2 = emptyLearnEditState();
    const a = b2.indexOf("展场");
    st2 = applyBeforeInputToLearnEditState(st2, b2, b2, a, a + 2, "insertReplacementText", "会场");
    const mid = b2.slice(0, a) + "会场" + b2.slice(a + 2);
    const bIdx = mid.indexOf("扳手");
    st2 = applyInputEventToLearnEditState(st2, b2, mid, bIdx, bIdx + 2, live2);
    expect(explicitPairsFromLearnEditState(st2, b2, live2).length).toBe(2);
  });

  it("PASS: 同位置二次改词（誓死→新词）", () => {
    const baseline = "只有这种视死悟道的决心。";
    const start = baseline.indexOf("视死");
    let state = applyBeforeInputToLearnEditState(
      emptyLearnEditState(),
      baseline,
      baseline,
      start,
      start + 2,
      "insertReplacementText",
      "誓死",
    );
    const live2 = "只有这种新词悟道的决心。";
    const live1 = "只有这种誓死悟道的决心。";
    state = applyInputEventToLearnEditState(
      state,
      baseline,
      live1,
      live1.indexOf("誓死"),
      live1.indexOf("誓死") + 2,
      live2,
    );
    expect(state.ops).toHaveLength(1);
    expect(state.ops[0]).toEqual({ anchor: start, removed: "视死", inserted: "新词" });
    expect(hasLearnablePair(baseline, live2, state)).toBe(true);
  });

  it("EXPECTED: 仅删除 / 改回原文 → 无 learnable", () => {
    const baseline = "只有这种视死悟道的决心。";
    const start = baseline.indexOf("视死");
    const onlyDel = baseline.slice(0, start) + baseline.slice(start + 2);
    let st = applyInputEventToLearnEditState(emptyLearnEditState(), baseline, baseline, start, start + 2, onlyDel);
    expect(explicitPairsFromLearnEditState(st, baseline, onlyDel)).toEqual([]);

    st = applyBeforeInputToLearnEditState(st, baseline, baseline, start, start + 2, "insertReplacementText", "誓死");
    st = applyInputEventToLearnEditState(st, baseline, "只有这种誓死悟道的决心。", start, start + 2, baseline);
    expect(explicitPairsFromLearnEditState(st, baseline, baseline)).toEqual([]);
  });

  it("EXPECTED: 单字 CJK 替换 → 过滤", () => {
    const baseline = "尤其是其道场";
    const live = "尤其是七道场";
    const start = baseline.indexOf("其");
    const st = applyBeforeInputToLearnEditState(
      emptyLearnEditState(),
      baseline,
      baseline,
      start,
      start + 1,
      "insertReplacementText",
      "七",
    );
    expect(explicitPairsFromLearnEditState(st, baseline, live)).toEqual([]);
    expect(partitionPendingLearnChanges(baseline, live, st).learnablePairs).toEqual([]);
  });

  it("KNOWN-LIMIT: 纯追加无 removed → 无 learnable", () => {
    const baseline = "只有这种视死";
    const live = "只有这种视死悟道";
    const st = applyInputEventToLearnEditState(
      emptyLearnEditState(),
      baseline,
      baseline,
      baseline.length,
      baseline.length,
      live,
    );
    expect(learnEditStateMatchesLive(st, baseline, live)).toBe(true);
    expect(explicitPairsFromLearnEditState(st, baseline, live)).toEqual([]);
  });

  it("PASS: 选区含标点一并替换 → 剥离标点后仍可学", () => {
    const baseline = "只有这种视死，悟道的决心。";
    const live = "只有这种誓死，悟道的决心。";
    const start = baseline.indexOf("视死，");
    const st = applyBeforeInputToLearnEditState(
      emptyLearnEditState(),
      baseline,
      baseline,
      start,
      start + 3,
      "insertReplacementText",
      "誓死，",
    );
    expect(learnEditStateMatchesLive(st, baseline, live)).toBe(true);
    expect(explicitPairsFromLearnEditState(st, baseline, live)).toEqual([
      { beforeText: "视死", afterText: "誓死" },
    ]);
    expect(hasLearnablePair(baseline, live, st)).toBe(true);
  });

  it("PASS: 追踪仅「学→觉观」时按聚焦基线补全为「学关→觉观」", () => {
    const baseline = "我们学关到了之后，";
    const live = "我们觉观到了之后，";
    const start = baseline.indexOf("学");
    let st = applyBeforeInputToLearnEditState(
      emptyLearnEditState(),
      baseline,
      baseline,
      start,
      start + 1,
      "insertReplacementText",
      "觉观",
    );
    expect(st.ops[0]).toEqual({ anchor: start, removed: "学", inserted: "觉观" });
    st = syncLearnEditStateToBaselineLive(baseline, live, st);
    expect(explicitPairsFromLearnEditState(st, baseline, live)).toEqual([
      { beforeText: "学关", afterText: "觉观" },
    ]);
  });

  it("PASS: 改词同时补标点或空格 → 剥离后可学", () => {
    const baseline = "只有这种视死悟道的决心";
    const live = "只有这种誓死，悟道的决心";
    const start = baseline.indexOf("视死");
    let st = applyBeforeInputToLearnEditState(
      emptyLearnEditState(),
      baseline,
      baseline,
      start,
      start + 2,
      "insertReplacementText",
      "誓死，",
    );
    expect(explicitPairsFromLearnEditState(st, baseline, live)).toEqual([
      { beforeText: "视死", afterText: "誓死" },
    ]);

    const baseline2 = "只有这种 视死 悟道";
    const live2 = "只有这种 誓死 悟道";
    const start2 = baseline2.indexOf("视死");
    st = applyBeforeInputToLearnEditState(
      emptyLearnEditState(),
      baseline2,
      baseline2,
      start2,
      start2 + 2,
      "insertReplacementText",
      "誓死",
    );
    expect(explicitPairsFromLearnEditState(st, baseline2, live2)).toEqual([
      { beforeText: "视死", afterText: "誓死" },
    ]);
  });

  it("EXPECTED: 仅改标点 → 剥离后无词面，不可学", () => {
    const baseline = "只有这种视死，悟道";
    const live = "只有这种视死。悟道";
    const start = baseline.indexOf("，");
    const st = applyBeforeInputToLearnEditState(
      emptyLearnEditState(),
      baseline,
      baseline,
      start,
      start + 1,
      "insertReplacementText",
      "。",
    );
    expect(explicitPairsFromLearnEditState(st, baseline, live)).toEqual([]);
  });

  it("KNOWN-LIMIT: contiguous 兜底在共享字 CJK 会缩成单字对并被过滤", () => {
    const baseline = "只有这种视死悟道的决心。";
    const live = "只有这种誓死悟道的决心。";
    const st = applyInputEventToLearnEditState(emptyLearnEditState(), baseline, baseline, 0, 0, live);
    expect(explicitPairsFromLearnEditState(st, baseline, live)).toEqual([]);
  });
});
