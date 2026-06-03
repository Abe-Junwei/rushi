import { describe, expect, it } from "vitest";
import { applyStableRulesToPolishLines } from "./exportPolishFinalize";
import type { CorrectionRuleRow } from "../tauri/correctionApi";

function rule(
  wrong: string,
  right: string,
  acceptedAsRule = false,
): CorrectionRuleRow {
  return { wrong, right, hitCount: 2, acceptedAsRule };
}

describe("applyStableRulesToPolishLines (export)", () => {
  it("applies multi-char stable rules", () => {
    const { lines, stats } = applyStableRulesToPolishLines(["山通开示"], [rule("山通", "禅宗")]);
    expect(lines[0]).toBe("禅宗开示");
    expect(stats.multiCharReplacements).toBe(1);
  });

  it("does not apply single-char unless accepted as rule", () => {
    const { lines, stats } = applyStableRulesToPolishLines(
      ["一棵大树"],
      [rule("棵", "颗", false)],
    );
    expect(lines[0]).toBe("一棵大树");
    expect(stats.singleCharReplacements).toBe(0);
  });

  it("applies accepted single-char rules with replaceAll", () => {
    const { lines, stats } = applyStableRulesToPolishLines(
      ["一棵大树"],
      [rule("棵", "颗", true)],
    );
    expect(lines[0]).toBe("一颗大树");
    expect(stats.singleCharReplacements).toBe(1);
  });

  it("skips non-accepted single-char global replace (城市)", () => {
    const { lines } = applyStableRulesToPolishLines(["城市"], [rule("市", "镇", false)]);
    expect(lines[0]).toBe("城市");
  });

  it("global replace applies multi-char rule 传讨", () => {
    const { lines, stats } = applyStableRulesToPolishLines(
      ["传统传讨打七"],
      [rule("传讨", "传统")],
    );
    expect(lines[0]).toBe("传统传统打七");
    expect(stats.multiCharReplacements).toBe(1);
  });
});
