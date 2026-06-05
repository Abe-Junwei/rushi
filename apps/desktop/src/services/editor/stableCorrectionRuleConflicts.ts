import type { CorrectionRuleRow } from "../../tauri/correctionApi";

export type StableCorrectionRuleConflict = {
  wrong: string;
  rights: string[];
};

/** A4：稳定规则中同错形、多正形时阻塞写回。 */
export function detectStableCorrectionRuleConflicts(
  rows: CorrectionRuleRow[],
): StableCorrectionRuleConflict[] {
  const byWrong = new Map<string, Set<string>>();
  for (const row of rows) {
    const wrong = row.wrong.trim();
    const right = row.right.trim();
    if (!wrong || !right || wrong === right) continue;
    const set = byWrong.get(wrong) ?? new Set<string>();
    set.add(right);
    byWrong.set(wrong, set);
  }
  const out: StableCorrectionRuleConflict[] = [];
  for (const [wrong, rights] of byWrong) {
    if (rights.size <= 1) continue;
    out.push({
      wrong,
      rights: [...rights].sort((a, b) => a.localeCompare(b, "zh")),
    });
  }
  return out.sort((a, b) => a.wrong.localeCompare(b.wrong, "zh"));
}

export function formatStableRuleConflictMessage(conflicts: StableCorrectionRuleConflict[]): string {
  if (!conflicts.length) return "";
  const lines = conflicts.map(
    (c) => `「${c.wrong}」对应 ${c.rights.map((r) => `「${r}」`).join("、")}`,
  );
  return `稳定纠错规则存在冲突，请先在「热词与记忆」中决议后再应用：${lines.join("；")}`;
}
