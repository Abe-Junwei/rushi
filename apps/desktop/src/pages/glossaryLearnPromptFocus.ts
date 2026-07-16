import type { GlossaryLearnPromptRow } from "../tauri/correctionApi";

/** F6：只保留本次纳入正形对应的进表候选，不扫全局 backlog。 */
export function filterGlossaryLearnPromptsForFocus(
  rows: GlossaryLearnPromptRow[],
  focusAfterTexts: readonly string[],
): GlossaryLearnPromptRow[] {
  const focus = new Set(
    focusAfterTexts.map((t) => t.trim()).filter((t) => t.length > 0),
  );
  if (focus.size === 0) return [];
  return rows.filter((r) => focus.has(r.afterText.trim()));
}
