import type { CorrectionMemoryEntryRow } from "../tauri/correctionApi";
import type { GlossaryTermDto } from "../tauri/glossaryApi";
import { compareZhPinyin } from "../utils/zhPinyinCompare";

export type GlossaryListSortMode = "updated" | "pinyin-asc" | "pinyin-desc";

export function sortGlossaryTerms(rows: GlossaryTermDto[], mode: GlossaryListSortMode): GlossaryTermDto[] {
  const copy = [...rows];
  if (mode === "updated") {
    return copy.sort(
      (a, b) =>
        (b.updated_at_ms ?? b.created_at_ms) - (a.updated_at_ms ?? a.created_at_ms) || a.id - b.id,
    );
  }
  const dir = mode === "pinyin-asc" ? 1 : -1;
  return copy.sort((a, b) => dir * compareZhPinyin(a.term, b.term) || a.id - b.id);
}

export function sortCorrectionMemoryRows(
  rows: CorrectionMemoryEntryRow[],
  mode: GlossaryListSortMode,
): CorrectionMemoryEntryRow[] {
  const copy = [...rows];
  if (mode === "updated") {
    return copy.sort((a, b) => b.updatedAtMs - a.updatedAtMs || compareZhPinyin(a.wrong, b.wrong));
  }
  const dir = mode === "pinyin-asc" ? 1 : -1;
  return copy.sort(
    (a, b) =>
      dir * compareZhPinyin(a.wrong, b.wrong) ||
      dir * compareZhPinyin(a.right, b.right) ||
      b.updatedAtMs - a.updatedAtMs,
  );
}
