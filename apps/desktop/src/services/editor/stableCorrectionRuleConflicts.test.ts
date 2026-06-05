import { describe, expect, it } from "vitest";
import {
  detectStableCorrectionRuleConflicts,
  formatStableRuleConflictMessage,
} from "./stableCorrectionRuleConflicts";

describe("stableCorrectionRuleConflicts", () => {
  it("detects same wrong with multiple rights", () => {
    const conflicts = detectStableCorrectionRuleConflicts([
      { wrong: "智控", right: "制控", hitCount: 3, acceptedAsRule: false },
      { wrong: "智控", right: "自控", hitCount: 5, acceptedAsRule: false },
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.rights).toEqual(["制控", "自控"]);
  });

  it("formats conflict message", () => {
    const msg = formatStableRuleConflictMessage([
      { wrong: "智控", rights: ["制控", "自控"] },
    ]);
    expect(msg).toContain("智控");
    expect(msg).toContain("冲突");
  });
});
