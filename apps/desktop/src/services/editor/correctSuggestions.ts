import type { CorrectionRuleRow } from "../../tauri/correctionApi";
import type { GlossaryTermDto } from "../../tauri/glossaryApi";

export type CorrectSuggestion =
  | { kind: "rule"; wrong: string; right: string; hitCount: number; acceptedAsRule: boolean }
  | { kind: "glossary"; term: string; aliases: string; note: string };

function needleInHaystack(needle: string, hay: string): boolean {
  const n = needle.trim();
  const h = hay.trim();
  if (!n || !h) return false;
  return h.includes(n) || n.includes(h);
}

/** Literal match only — no homophone guessing. */
export function filterCorrectSuggestions(
  selection: string,
  rules: CorrectionRuleRow[],
  glossary: GlossaryTermDto[],
): CorrectSuggestion[] {
  const sel = selection.trim();
  if (!sel) return [];
  const out: CorrectSuggestion[] = [];
  const seenRule = new Set<string>();

  for (const row of rules) {
    const wrong = row.wrong.trim();
    const right = row.right.trim();
    if (!wrong || !right || wrong === right) continue;
    if (!needleInHaystack(sel, wrong) && !needleInHaystack(sel, right)) continue;
    const key = `${wrong}\0${right}`;
    if (seenRule.has(key)) continue;
    seenRule.add(key);
    out.push({
      kind: "rule",
      wrong,
      right,
      hitCount: row.hitCount,
      acceptedAsRule: row.acceptedAsRule,
    });
  }

  for (const row of glossary) {
    const term = row.term.trim();
    if (!term) continue;
    const aliases = (row.aliases ?? "").trim();
    if (!needleInHaystack(sel, term) && !(aliases && needleInHaystack(sel, aliases))) continue;
    out.push({
      kind: "glossary",
      term,
      aliases,
      note: (row.note ?? "").trim(),
    });
  }

  return out;
}
