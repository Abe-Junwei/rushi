import type { SegmentDto } from "../../tauri/projectApi";
import type { CorrectionRuleRow } from "../../tauri/correctionApi";
import { splitGraphemes } from "../text/grapheme";
import { formatSegmentTimeLabel } from "./segmentFindReplace";

export type CorrectionRulePair = { wrong: string; right: string };

export type SegmentCorrectionChange = {
  segmentIdx: number;
  segmentNumber: number;
  timeLabel: string;
  beforeText: string;
  afterText: string;
  replacementCount: number;
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
} {
  if (!text || !rules.length) return { text, count: 0 };
  const sorted = [...rules]
    .filter((r) => r.wrong.length >= MIN_WRONG_LEN)
    .sort((a, b) => b.wrong.length - a.wrong.length);
  const chars = splitGraphemes(text);
  const out: string[] = [];
  let i = 0;
  let count = 0;
  while (i < chars.length) {
    let matched: CorrectionRulePair | null = null;
    for (const rule of sorted) {
      const w = splitGraphemes(rule.wrong);
      if (i + w.length > chars.length) continue;
      if (chars.slice(i, i + w.length).join("") === rule.wrong) {
        if (!matched || rule.wrong.length > matched.wrong.length) matched = rule;
      }
    }
    if (matched) {
      out.push(matched.right);
      i += splitGraphemes(matched.wrong).length;
      count += 1;
    } else {
      const ch = chars[i];
      if (ch !== undefined) out.push(ch);
      i += 1;
    }
  }
  return { text: out.join(""), count };
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
      beforeText,
      afterText: applied.text,
      replacementCount: applied.count,
    });
  }
  return out;
}
