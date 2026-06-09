import type { CorrectionRulesDialogState } from "../pages/useCorrectionRulesController";
import {
  CORRECTION_RULES_EMPTY_STATIC_BODY_PX,
  CORRECTION_RULES_LOADING_BODY_PX,
  CORRECTION_RULES_PREVIEW_STATIC_BODY_PX,
  LEXICON_HEALTH_PANEL_BODY_CHROME_PX,
  LEXICON_HEALTH_PANEL_LINE_PX,
  LEXICON_HEALTH_PANEL_SUMMARY_PX,
  resolveFloatingPanelCompactFitHeight,
} from "./floatingPanelSegmentListLayout";
import {
  resolveFloatingPanelSectionsFitHeight,
  type FloatingPanelFitSection,
} from "./floatingPanelFitSections";

export function resolveCorrectionRulesDialogTitle(state: CorrectionRulesDialogState): string {
  const postTranscribe =
    (state.phase === "preview" || state.phase === "loading" || state.phase === "empty") &&
    state.trigger === "postTranscribe";
  if (postTranscribe || state.phase === "empty" || state.phase === "preview") {
    return state.phase === "preview" ? "规则纠错预览" : "规则纠错";
  }
  return "规则纠错";
}

export function resolveCorrectionRulesContentFitHeight(input: {
  state: CorrectionRulesDialogState;
  hintsExpanded: boolean;
  lexiconExpanded: boolean;
  lexiconHealthLineCount: number;
  hasReadOnlyHints: boolean;
  previewTotalCount: number;
}): number | undefined {
  const { state, hintsExpanded, lexiconExpanded, lexiconHealthLineCount, hasReadOnlyHints, previewTotalCount } =
    input;
  const preview = state.phase === "preview" ? state : null;
  const isEmpty = state.phase === "empty";
  const isLoading = state.phase === "loading";
  const postTranscribe =
    (state.phase === "preview" || state.phase === "loading" || state.phase === "empty") &&
    state.trigger === "postTranscribe";

  const buildSections = (rowCount: number): FloatingPanelFitSection[] => {
    const sections: FloatingPanelFitSection[] = [
      {
        kind: "static",
        px: isEmpty ? CORRECTION_RULES_EMPTY_STATIC_BODY_PX : CORRECTION_RULES_PREVIEW_STATIC_BODY_PX,
      },
    ];
    if (hasReadOnlyHints) {
      sections.push({
        kind: "details",
        lineCount:
          (state.phase === "empty"
            ? state.readOnlyLearningHints.length + state.readOnlyTranscribeHints.length
            : preview!.readOnlyLearningHints.length + preview!.readOnlyTranscribeHints.length) || 1,
        expanded: hintsExpanded,
      });
    }
    if (lexiconHealthLineCount > 0) {
      sections.push({
        kind: "details",
        lineCount: lexiconHealthLineCount,
        expanded: lexiconExpanded,
        summaryPx: LEXICON_HEALTH_PANEL_SUMMARY_PX,
        linePx: LEXICON_HEALTH_PANEL_LINE_PX,
        bodyChromePx: LEXICON_HEALTH_PANEL_BODY_CHROME_PX,
      });
    }
    if (postTranscribe && isEmpty) {
      sections.push({ kind: "mutedLine", show: true });
    }
    if (rowCount > 0) {
      sections.push({ kind: "segmentList", rowCount });
    }
    return sections;
  };

  if (preview) {
    return resolveFloatingPanelSectionsFitHeight(buildSections(previewTotalCount));
  }
  if (isEmpty) {
    return resolveFloatingPanelSectionsFitHeight(buildSections(0));
  }
  if (isLoading) {
    return resolveFloatingPanelCompactFitHeight(CORRECTION_RULES_LOADING_BODY_PX);
  }
  return undefined;
}
