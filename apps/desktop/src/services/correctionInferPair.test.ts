import { describe, expect, it } from "vitest";
import {
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
