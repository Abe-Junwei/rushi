import { correctionMemoryList, correctionStableRulesList } from "../tauri/correctionApi";
import {
  toRulePairs,
  type SegmentCorrectionChange,
} from "../services/editor/segmentCorrectionRulesApply";
import { buildLexiconHealthReport, type LexiconHealthReport } from "../services/editor/lexiconHealthReport";
import {
  applySegmentTextHygiene,
  segmentTextHygieneChanged,
} from "../services/editor/segmentTextHygiene";
import { buildStageAPreviewChanges } from "../services/editor/stageAPreviewPipeline";
import {
  filterReadOnlyCorrectionRuleHints,
  parseCorrectionRuleHintsFromWarnings,
  type CorrectionRuleHintPair,
} from "../services/editor/correctionRuleHints";
import {
  detectStableCorrectionRuleConflicts,
  type StableCorrectionRuleConflict,
} from "../services/editor/stableCorrectionRuleConflicts";
import {
  listLearningCorrectionHintsForSegments,
  type LearningCorrectionHint,
} from "../services/editor/learningCorrectionRuleHints";
import type { SegmentDto } from "../tauri/projectApi";

export type CorrectionRulesPreviewLoadResult = {
  changes: SegmentCorrectionChange[];
  ruleCount: number;
  hygieneTouchedCount: number;
  lexiconHealth: LexiconHealthReport;
  readOnlyTranscribeHints: CorrectionRuleHintPair[];
  readOnlyLearningHints: LearningCorrectionHint[];
  stableConflicts: StableCorrectionRuleConflict[];
};

export async function loadCorrectionRulesPreview(args: {
  segments: SegmentDto[];
  transcribeWarnings: string[];
}): Promise<CorrectionRulesPreviewLoadResult> {
  const [rows, memoryEntries] = await Promise.all([
    correctionStableRulesList(),
    correctionMemoryList(),
  ]);
  const pairs = toRulePairs(rows);
  const changes = buildStageAPreviewChanges(args.segments, pairs);
  const stableConflicts = detectStableCorrectionRuleConflicts(rows);
  const lexiconHealth = buildLexiconHealthReport({
    memoryEntries,
    stableRules: rows,
    stableConflicts,
    segments: args.segments,
  });
  let hygieneTouchedCount = 0;
  for (const seg of args.segments) {
    const before = seg.text ?? "";
    if (segmentTextHygieneChanged(before, applySegmentTextHygiene(before))) {
      hygieneTouchedCount += 1;
    }
  }
  const hintPairs = filterReadOnlyCorrectionRuleHints(
    parseCorrectionRuleHintsFromWarnings(args.transcribeWarnings),
    pairs,
  );
  const readOnlyTranscribeHints = hintPairs;
  const transcribeKeys = new Set(
    hintPairs.map((h) => `${h.beforeText.trim()}\u0000${h.afterText.trim()}`),
  );
  const readOnlyLearningHints = listLearningCorrectionHintsForSegments(
    memoryEntries,
    pairs,
    args.segments,
  ).filter((h) => !transcribeKeys.has(`${h.beforeText}\u0000${h.afterText}`));
  return {
    changes,
    ruleCount: pairs.length,
    hygieneTouchedCount,
    lexiconHealth,
    readOnlyTranscribeHints,
    readOnlyLearningHints,
    stableConflicts,
  };
}
