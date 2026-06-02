import type { CorrectionRuleRow } from "../../tauri/correctionApi";
import type { CorrectSuggestion } from "./correctSuggestions";
import { filterCorrectSuggestions } from "./correctSuggestions";
import { splitGraphemes } from "../text/grapheme";

export type CorrectableSpan = {
  charStart: number;
  charEnd: number;
  surface: string;
};

const MIN_WRONG_LEN = 2;

function rulePairs(rows: CorrectionRuleRow[]): { wrong: string; right: string }[] {
  return rows
    .map((r) => ({ wrong: r.wrong.trim(), right: r.right.trim() }))
    .filter((r) => r.wrong.length >= MIN_WRONG_LEN && r.right && r.wrong !== r.right)
    .sort((a, b) => b.wrong.length - a.wrong.length);
}

/** 非重叠字面匹配稳定规则中的错形（长词优先）。 */
export function findCorrectableSpans(text: string, rules: CorrectionRuleRow[]): CorrectableSpan[] {
  if (!text || !rules.length) return [];
  const pairs = rulePairs(rules);
  if (!pairs.length) return [];
  const chars = splitGraphemes(text);
  const occupied = new Array<boolean>(chars.length).fill(false);
  const out: CorrectableSpan[] = [];

  for (const rule of pairs) {
    const wChars = splitGraphemes(rule.wrong);
    if (!wChars.length) continue;
    let i = 0;
    while (i + wChars.length <= chars.length) {
      if (occupied[i]) {
        i += 1;
        continue;
      }
      let match = true;
      for (let j = 0; j < wChars.length; j++) {
        if (chars[i + j] !== wChars[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        for (let j = 0; j < wChars.length; j++) occupied[i + j] = true;
        out.push({
          charStart: i,
          charEnd: i + wChars.length,
          surface: rule.wrong,
        });
        i += wChars.length;
      } else {
        i += 1;
      }
    }
  }

  return out.sort((a, b) => a.charStart - b.charStart);
}

export function correctSuggestionsForSurface(
  surface: string,
  rules: CorrectionRuleRow[],
  glossary: import("../../tauri/glossaryApi").GlossaryTermDto[],
): CorrectSuggestion[] {
  return filterCorrectSuggestions(surface, rules, glossary);
}
