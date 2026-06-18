import type { CorrectionRulesDialogState } from "../pages/useCorrectionRulesController";

/** 布局 / persist 失效基线；动态项见 resolveCorrectionRulesLayoutRev。 */
export const CORRECTION_RULES_LAYOUT_REV_BASE = 6;

export function resolveCorrectionRulesLayoutRev(input: {
  phase: CorrectionRulesDialogState["phase"];
  previewTotalCount: number;
  hintsExpanded: boolean;
  lexiconExpanded: boolean;
  lexiconHealthLineCount: number;
  hasReadOnlyHints: boolean;
  hasStableConflictMessage: boolean;
  postTranscribe: boolean;
  readOnlyHintCount: number;
}): number {
  let rev = CORRECTION_RULES_LAYOUT_REV_BASE;
  rev +=
    input.phase === "loading" ? 10 : input.phase === "preview" ? 20 : input.phase === "empty" ? 30 : 0;
  rev += input.previewTotalCount;
  if (input.hintsExpanded) rev += 100;
  if (input.lexiconExpanded) rev += 200 + input.lexiconHealthLineCount;
  if (input.hasReadOnlyHints) rev += 400;
  if (input.hasStableConflictMessage) rev += 800;
  if (input.postTranscribe) rev += 1600;
  rev += input.readOnlyHintCount;
  return rev;
}
