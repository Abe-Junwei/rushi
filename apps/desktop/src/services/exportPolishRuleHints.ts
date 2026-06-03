import type { CorrectionRuleRow } from "../tauri/correctionApi";
import { splitGraphemes } from "./text/grapheme";

const MAX_HINT_RULES = 48;

/** 供 export_polish prompt 注入的稳定纠错规则摘要。 */
export function buildExportPolishRuleHints(rules: CorrectionRuleRow[]): string {
  const rows = rules
    .filter((r) => r.wrong.trim() && r.right.trim() && r.wrong.trim() !== r.right.trim())
    .slice(0, MAX_HINT_RULES);
  if (rows.length === 0) return "";
  return rows
    .map((r) => {
      const w = r.wrong.trim();
      const right = r.right.trim();
      const single = splitGraphemes(w).length === 1 ? "（单字，须在对应行替换）" : "";
      return `- 「${w}」→「${right}」${single}`;
    })
    .join("\n");
}
