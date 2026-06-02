import type { CorrectionMemoryEntryRow } from "../tauri/correctionApi";

export type CorrectionMemoryConflictGroup = {
  wrong: string;
  entries: CorrectionMemoryEntryRow[];
};

/** 同错形、不同正形（MEM-P3 编辑台/记忆页提示用）。 */
export function groupCorrectionMemoryConflicts(
  rows: CorrectionMemoryEntryRow[],
): CorrectionMemoryConflictGroup[] {
  const byWrong = new Map<string, CorrectionMemoryEntryRow[]>();
  for (const row of rows) {
    const wrong = row.wrong.trim();
    if (!wrong) continue;
    const list = byWrong.get(wrong) ?? [];
    list.push(row);
    byWrong.set(wrong, list);
  }
  const out: CorrectionMemoryConflictGroup[] = [];
  for (const [wrong, entries] of byWrong) {
    const rights = new Set(entries.map((e) => e.right.trim()));
    if (rights.size <= 1) continue;
    out.push({
      wrong,
      entries: [...entries].sort((a, b) => b.hitCount - a.hitCount || b.updatedAtMs - a.updatedAtMs),
    });
  }
  return out.sort((a, b) => a.wrong.localeCompare(b.wrong, "zh"));
}
