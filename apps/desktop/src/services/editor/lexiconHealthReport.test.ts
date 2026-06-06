import { describe, expect, it } from "vitest";
import type { CorrectionMemoryEntryRow, CorrectionRuleRow } from "../../tauri/correctionApi";
import type { SegmentDto } from "../../tauri/projectApi";
import { buildLexiconHealthReport } from "./lexiconHealthReport";

describe("lexiconHealthReport", () => {
  it("summarizes noise, learning, conflicts, and orphan rules", () => {
    const memoryEntries: CorrectionMemoryEntryRow[] = [
      {
        wrong: "甲",
        right: "乙",
        hitCount: 1,
        acceptedAsRule: false,
        updatedAtMs: 1,
        isStable: false,
      },
      {
        wrong: "丙",
        right: "丁",
        hitCount: 2,
        acceptedAsRule: false,
        updatedAtMs: 2,
        isStable: false,
      },
    ];
    const stableRules: CorrectionRuleRow[] = [
      { wrong: "悬空", right: "正形", hitCount: 3, acceptedAsRule: false },
      { wrong: "制控", right: "智控", hitCount: 3, acceptedAsRule: false },
    ];
    const segments: SegmentDto[] = [
      { uid: "s1", idx: 0, start_sec: 0, end_sec: 1, text: "这里有制控" },
    ];

    const report = buildLexiconHealthReport({
      memoryEntries,
      stableRules,
      stableConflicts: [{ wrong: "x", rights: ["a", "b"] }],
      segments,
    });

    expect(report.noiseHit1Count).toBe(1);
    expect(report.learningHit2Count).toBe(1);
    expect(report.orphanRuleCount).toBe(1);
    expect(report.stableConflictCount).toBe(1);
    expect(report.hasActionableIssues).toBe(true);
    expect(report.summaryLines.some((l) => l.includes("噪声"))).toBe(true);
  });
});
