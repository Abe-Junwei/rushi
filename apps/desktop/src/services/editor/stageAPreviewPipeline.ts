import type { SegmentDto } from "../../tauri/projectApi";
import {
  applyCorrectionRulesToText,
  buildSegmentCorrectionChanges,
  type CorrectionRulePair,
  type SegmentCorrectionChange,
} from "./segmentCorrectionRulesApply";
import { applySegmentTextHygiene, segmentTextHygieneChanged } from "./segmentTextHygiene";
import { formatSegmentStartTimeLabel, formatSegmentTimeLabel } from "./segmentFindReplace";

/** A6 → A1：先在清洗后正文上匹配规则，预览展示 original → final。 */
export function buildStageAPreviewChanges(
  segments: SegmentDto[],
  rules: CorrectionRulePair[],
): SegmentCorrectionChange[] {
  const out: SegmentCorrectionChange[] = [];
  for (let segmentIdx = 0; segmentIdx < segments.length; segmentIdx++) {
    const seg = segments[segmentIdx];
    if (!seg) continue;
    const beforeText = seg.text ?? "";
    const hygienedText = applySegmentTextHygiene(beforeText);
    const hygieneTouched = segmentTextHygieneChanged(beforeText, hygienedText);
    const applied = rules.length
      ? applyCorrectionRulesToText(hygienedText, rules)
      : { text: hygienedText, count: 0, beforeHighlights: [], afterHighlights: [] };
    const afterText = applied.text;
    if (afterText === beforeText) continue;

    const ruleHighlightsOnOriginal =
      hygieneTouched || applied.count <= 0
        ? { beforeHighlights: [], afterHighlights: [] }
        : applied;

    out.push({
      segmentIdx,
      segmentNumber: segmentIdx + 1,
      timeLabel: formatSegmentTimeLabel(seg),
      startTimeLabel: formatSegmentStartTimeLabel(seg),
      beforeText,
      afterText,
      replacementCount: applied.count + (hygieneTouched ? 1 : 0),
      beforeHighlights: ruleHighlightsOnOriginal.beforeHighlights,
      afterHighlights: ruleHighlightsOnOriginal.afterHighlights,
    });
  }
  return out;
}

/** @deprecated 仅规则、无 A6；保留供对比测试。 */
export function buildStageARuleOnlyPreviewChanges(
  segments: SegmentDto[],
  rules: CorrectionRulePair[],
): SegmentCorrectionChange[] {
  return buildSegmentCorrectionChanges(segments, rules);
}
