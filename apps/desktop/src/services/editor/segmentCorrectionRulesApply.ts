import type { SegmentDto } from "../../tauri/projectApi";
import type { CorrectionRuleRow } from "../../tauri/correctionApi";
import { splitGraphemes } from "../text/grapheme";
import { formatSegmentStartTimeLabel, formatSegmentTimeLabel } from "./segmentFindReplace";

export type CorrectionRulePair = { wrong: string; right: string };

/** 字素索引区间 [startG, endG)，用于预览高亮 */
export type CorrectionHighlightSpan = { startG: number; endG: number };

export type SegmentCorrectionChange = {
  segmentIdx: number;
  segmentNumber: number;
  timeLabel: string;
  startTimeLabel: string;
  beforeText: string;
  afterText: string;
  replacementCount: number;
  beforeHighlights: CorrectionHighlightSpan[];
  afterHighlights: CorrectionHighlightSpan[];
};

const MIN_WRONG_LEN = 2;

export function toRulePairs(rows: CorrectionRuleRow[]): CorrectionRulePair[] {
  return rows
    .map((r) => ({ wrong: r.wrong.trim(), right: r.right.trim() }))
    .filter((r) => r.wrong.length >= MIN_WRONG_LEN && r.right && r.wrong !== r.right);
}

/** Longest-first non-overlapping literal scan (v1 skips single-char wrong). */
export function applyCorrectionRulesToText(text: string, rules: CorrectionRulePair[]): {
  text: string;
  count: number;
  beforeHighlights: CorrectionHighlightSpan[];
  afterHighlights: CorrectionHighlightSpan[];
} {
  if (!text || !rules.length) {
    return { text, count: 0, beforeHighlights: [], afterHighlights: [] };
  }
  const sorted = [...rules]
    .filter((r) => r.wrong.length >= MIN_WRONG_LEN)
    .sort((a, b) => b.wrong.length - a.wrong.length);
  const chars = splitGraphemes(text);
  const out: string[] = [];
  const beforeHighlights: CorrectionHighlightSpan[] = [];
  const afterHighlights: CorrectionHighlightSpan[] = [];
  let i = 0;
  let afterG = 0;
  let count = 0;
  while (i < chars.length) {
    let matched: CorrectionRulePair | null = null;
    let matchedLen = 0;
    for (const rule of sorted) {
      const w = splitGraphemes(rule.wrong);
      if (i + w.length > chars.length) continue;
      if (chars.slice(i, i + w.length).join("") === rule.wrong) {
        if (!matched || rule.wrong.length > matched.wrong.length) {
          matched = rule;
          matchedLen = w.length;
        }
      }
    }
    if (matched) {
      const rightGlyphs = splitGraphemes(matched.right);
      beforeHighlights.push({ startG: i, endG: i + matchedLen });
      afterHighlights.push({ startG: afterG, endG: afterG + rightGlyphs.length });
      out.push(matched.right);
      afterG += rightGlyphs.length;
      i += matchedLen;
      count += 1;
    } else {
      const ch = chars[i];
      if (ch !== undefined) out.push(ch);
      afterG += 1;
      i += 1;
    }
  }
  return { text: out.join(""), count, beforeHighlights, afterHighlights };
}

export function buildSegmentCorrectionChanges(
  segments: SegmentDto[],
  rules: CorrectionRulePair[],
): SegmentCorrectionChange[] {
  if (!rules.length) return [];
  const out: SegmentCorrectionChange[] = [];
  for (let segmentIdx = 0; segmentIdx < segments.length; segmentIdx++) {
    const seg = segments[segmentIdx];
    if (!seg) continue;
    const beforeText = seg.text ?? "";
    const applied = applyCorrectionRulesToText(beforeText, rules);
    if (applied.count <= 0 || applied.text === beforeText) continue;
    out.push({
      segmentIdx,
      segmentNumber: segmentIdx + 1,
      timeLabel: formatSegmentTimeLabel(seg),
      startTimeLabel: formatSegmentStartTimeLabel(seg),
      beforeText,
      afterText: applied.text,
      replacementCount: applied.count,
      beforeHighlights: applied.beforeHighlights,
      afterHighlights: applied.afterHighlights,
    });
  }
  return out;
}
