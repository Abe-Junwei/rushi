import { describe, expect, it } from "vitest";
import {
  applyBeforeInputToLearnEditState,
  emptyLearnEditState,
} from "./learnEditDelta";
import {
  buildConfirmExplicitPair,
  buildConfirmExplicitPairs,
  normalizeCorrectionLearnPair,
  shouldLearnInferredReplacement,
  stripCorrectionLearnNoise,
} from "./correctionInferPair";

describe("shouldLearnInferredReplacement", () => {
  it("rejects isolated single CJK char pairs", () => {
    expect(shouldLearnInferredReplacement("盈", "凌")).toBe(false);
    expect(shouldLearnInferredReplacement("其", "七")).toBe(false);
  });

  it("accepts multi-char phrase pairs", () => {
    expect(shouldLearnInferredReplacement("山通", "禅宗")).toBe(true);
    expect(shouldLearnInferredReplacement("错误", "正确")).toBe(true);
  });

  it("strips punctuation and whitespace before gating", () => {
    expect(stripCorrectionLearnNoise("视死，")).toBe("视死");
    expect(stripCorrectionLearnNoise(" 誓死 ")).toBe("誓死");
    expect(normalizeCorrectionLearnPair("视死，", "誓死，")).toEqual({
      beforeText: "视死",
      afterText: "誓死",
    });
    expect(shouldLearnInferredReplacement("视死，", "誓死，")).toBe(true);
    expect(shouldLearnInferredReplacement("视死", "誓死，")).toBe(true);
    expect(shouldLearnInferredReplacement("，", "。")).toBe(false);
  });
});

describe("buildConfirmExplicitPairs", () => {
  it("returns empty without learn tracking state", () => {
    expect(buildConfirmExplicitPair("安波那那", "安那般那")).toBeNull();
    expect(buildConfirmExplicitPairs("尤其是山通道场", "尤其是禅宗道场")).toEqual([]);
  });

  it("returns explicit pair from tracked selection replace", () => {
    const baseline = "安波那那";
    const live = "安那般那";
    let state = emptyLearnEditState();
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      baseline,
      0,
      baseline.length,
      "insertReplacementText",
      live,
    );
    expect(buildConfirmExplicitPairs(baseline, live, state)).toEqual([
      { beforeText: "安波那那", afterText: "安那般那" },
    ]);
  });

  it("returns empty for single-char CJK tracked replace", () => {
    const baseline = "尤其是其道场";
    const live = "尤其是七道场";
    const start = baseline.indexOf("其");
    let state = emptyLearnEditState();
    state = applyBeforeInputToLearnEditState(
      state,
      baseline,
      baseline,
      start,
      start + 1,
      "insertReplacementText",
      "七",
    );
    expect(buildConfirmExplicitPairs(baseline, live, state)).toEqual([]);
  });
});
