import { describe, expect, it } from "vitest";
import {
  filterReadOnlyCorrectionRuleHints,
  parseCorrectionRuleHintsFromWarnings,
} from "./correctionRuleHints";

describe("correctionRuleHints", () => {
  it("parses correction_rule_hint warnings", () => {
    const hints = parseCorrectionRuleHintsFromWarnings([
      "correction_rule_hint:安波那那->安那般那",
      "other_warning",
    ]);
    expect(hints).toEqual([{ beforeText: "安波那那", afterText: "安那般那" }]);
  });

  it("filters hints already covered by stable pairs", () => {
    const hints = parseCorrectionRuleHintsFromWarnings([
      "correction_rule_hint:甲->乙",
      "correction_rule_hint:丙->丁",
    ]);
    const readOnly = filterReadOnlyCorrectionRuleHints(hints, [{ wrong: "甲", right: "乙" }]);
    expect(readOnly).toEqual([{ beforeText: "丙", afterText: "丁" }]);
  });
});
