import type { CorrectionRuleRow } from "../tauri/correctionApi";
import { splitGraphemes } from "./text/grapheme";

export type ExportRuleApplyStats = {
  multiCharReplacements: number;
  singleCharReplacements: number;
};

const MAX_REPLACEMENTS_PER_RULE_PER_LINE = 32;

/** 稳定纠错规则：最长优先全局替换；单字仅「纳入规则」时替换。 */
export function applyStableRulesToPolishLines(
  lines: string[],
  rules: CorrectionRuleRow[],
): { lines: string[]; stats: ExportRuleApplyStats } {
  const sorted = [...rules]
    .map((r) => ({
      wrong: r.wrong.trim(),
      right: r.right.trim(),
      accepted: r.acceptedAsRule,
    }))
    .filter((r) => r.wrong && r.right && r.wrong !== r.right)
    .sort((a, b) => b.wrong.length - a.wrong.length);

  if (sorted.length === 0) {
    return { lines, stats: { multiCharReplacements: 0, singleCharReplacements: 0 } };
  }

  let multiCharReplacements = 0;
  let singleCharReplacements = 0;
  const out = lines.map((line) => {
    let text = line;
    for (const rule of sorted) {
      const wLen = splitGraphemes(rule.wrong).length;
      if (wLen === 1 && !rule.accepted) continue;
      if (!text.includes(rule.wrong)) continue;
      const parts = text.split(rule.wrong);
      let hits = parts.length - 1;
      if (hits <= 0) continue;
      if (hits > MAX_REPLACEMENTS_PER_RULE_PER_LINE) {
        text = parts
          .slice(0, MAX_REPLACEMENTS_PER_RULE_PER_LINE + 1)
          .join(rule.right);
        hits = MAX_REPLACEMENTS_PER_RULE_PER_LINE;
      } else {
        text = parts.join(rule.right);
      }
      if (wLen === 1) singleCharReplacements += hits;
      else multiCharReplacements += hits;
    }
    return text;
  });

  return { lines: out, stats: { multiCharReplacements, singleCharReplacements } };
}
