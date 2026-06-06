import type { CorrectionMemoryEntryRow, CorrectionRuleRow } from "../../tauri/correctionApi";
import type { SegmentDto } from "../../tauri/projectApi";
import { CORRECTION_MEMORY_STABLE_HIT } from "./learningCorrectionRuleHints";
import type { StableCorrectionRuleConflict } from "./stableCorrectionRuleConflicts";

export type LexiconHealthReport = {
  stableRuleCount: number;
  memoryTotalCount: number;
  noiseHit1Count: number;
  learningHit2Count: number;
  acceptedRuleCount: number;
  stableConflictCount: number;
  orphanRuleCount: number;
  summaryLines: string[];
  hasActionableIssues: boolean;
};

function countOrphanStableRules(rules: CorrectionRuleRow[], segments: SegmentDto[]): number {
  if (!rules.length || !segments.length) return 0;
  const corpus = segments.map((s) => s.text ?? "").join("\n");
  return rules.filter((r) => {
    const wrong = r.wrong.trim();
    return wrong.length >= 2 && !corpus.includes(wrong);
  }).length;
}

/** A9：词表/记忆卫生只读报告（F8 前移）。 */
export function buildLexiconHealthReport(args: {
  memoryEntries: CorrectionMemoryEntryRow[];
  stableRules: CorrectionRuleRow[];
  stableConflicts: StableCorrectionRuleConflict[];
  segments?: SegmentDto[];
}): LexiconHealthReport {
  const { memoryEntries, stableRules, stableConflicts, segments = [] } = args;

  let noiseHit1Count = 0;
  let learningHit2Count = 0;
  let acceptedRuleCount = 0;

  for (const row of memoryEntries) {
    if (row.acceptedAsRule) {
      acceptedRuleCount += 1;
      continue;
    }
    if (row.hitCount === 1) noiseHit1Count += 1;
    else if (row.hitCount === 2) learningHit2Count += 1;
  }

  const stableConflictCount = stableConflicts.length;
  const orphanRuleCount = countOrphanStableRules(stableRules, segments);

  const summaryLines: string[] = [];
  summaryLines.push(
    `稳定纠错规则 ${stableRules.length} 条 · 记忆库共 ${memoryEntries.length} 条`,
  );
  if (noiseHit1Count > 0) {
    summaryLines.push(
      `${noiseHit1Count} 条仅命中 1 次且未采纳（噪声候选，导出词表包前建议清理）`,
    );
  }
  if (learningHit2Count > 0) {
    summaryLines.push(
      `${learningHit2Count} 条学习中（命中 2/${CORRECTION_MEMORY_STABLE_HIT}，再命中 1 次可升为稳定规则）`,
    );
  }
  if (stableConflictCount > 0) {
    summaryLines.push(`${stableConflictCount} 组同错形多正形冲突（须先解决再写回）`);
  }
  if (orphanRuleCount > 0) {
    summaryLines.push(`${orphanRuleCount} 条稳定规则在当前稿中无字面匹配（悬空规则）`);
  }
  if (
    noiseHit1Count === 0 &&
    stableConflictCount === 0 &&
    orphanRuleCount === 0 &&
    memoryEntries.length === 0 &&
    stableRules.length === 0
  ) {
    summaryLines.push("暂无纠错记忆与稳定规则。");
  } else if (
    noiseHit1Count === 0 &&
    stableConflictCount === 0 &&
    orphanRuleCount === 0
  ) {
    summaryLines.push("词表卫生良好，无待处理冲突或噪声项。");
  }

  const hasActionableIssues =
    noiseHit1Count > 0 || stableConflictCount > 0 || orphanRuleCount > 0;

  return {
    stableRuleCount: stableRules.length,
    memoryTotalCount: memoryEntries.length,
    noiseHit1Count,
    learningHit2Count,
    acceptedRuleCount,
    stableConflictCount,
    orphanRuleCount,
    summaryLines,
    hasActionableIssues,
  };
}
