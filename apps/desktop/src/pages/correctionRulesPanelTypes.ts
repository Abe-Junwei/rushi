import type { CorrectionRuleHintPair } from "../services/editor/correctionRuleHints";
import type { LexiconHealthReport } from "../services/editor/lexiconHealthReport";
import type { LearningCorrectionHint } from "../services/editor/learningCorrectionRuleHints";
import type { SegmentCorrectionChange } from "../services/editor/segmentCorrectionRulesApply";
import type { StableCorrectionRuleConflict } from "../services/editor/stableCorrectionRuleConflicts";

export const CORRECTION_RULES_PANEL_ID = "correction-rules-preview-v1";

export function isCorrectionRulesPanelOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.getElementById(CORRECTION_RULES_PANEL_ID) != null;
}

export type CorrectionRulesDialogTrigger = "manual" | "postTranscribe";

export type CorrectionRulesDialogState =
  | { phase: "closed" }
  | { phase: "loading"; trigger?: CorrectionRulesDialogTrigger }
  | {
      phase: "preview";
      changes: SegmentCorrectionChange[];
      ruleCount: number;
      hygieneTouchedCount: number;
      lexiconHealth: LexiconHealthReport;
      selectedSegmentIdxs: number[];
      readOnlyTranscribeHints: CorrectionRuleHintPair[];
      readOnlyLearningHints: LearningCorrectionHint[];
      stableConflicts: StableCorrectionRuleConflict[];
      trigger?: CorrectionRulesDialogTrigger;
    }
  | {
      phase: "empty";
      readOnlyTranscribeHints: CorrectionRuleHintPair[];
      readOnlyLearningHints: LearningCorrectionHint[];
      lexiconHealth: LexiconHealthReport;
      trigger?: CorrectionRulesDialogTrigger;
    };
