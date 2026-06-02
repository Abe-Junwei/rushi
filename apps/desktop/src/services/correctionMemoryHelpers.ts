import type { CorrectionMemoryEntryRow } from "../tauri/correctionApi";

export type CorrectionMemoryDraft = {
  wrong: string;
  right: string;
  acceptedAsRule: boolean;
};

export type CorrectionMemoryKey = { wrong: string; right: string };

export const EMPTY_CORRECTION_MEMORY_DRAFT: CorrectionMemoryDraft = {
  wrong: "",
  right: "",
  acceptedAsRule: false,
};

export function correctionMemoryStableLabel(row: CorrectionMemoryEntryRow): string {
  if (row.acceptedAsRule) return "已采纳";
  if (row.hitCount >= 2) return "已稳定";
  return "学习中";
}

export function sameCorrectionMemoryKey(a: CorrectionMemoryKey, b: CorrectionMemoryKey): boolean {
  return a.wrong === b.wrong && a.right === b.right;
}

/** Stable row id for batch selection (wrong + right). */
export function correctionMemoryRowKey(row: CorrectionMemoryKey): string {
  return `${row.wrong}\u0000${row.right}`;
}

export function keyToCorrectionMemoryKey(key: string): CorrectionMemoryKey | null {
  const i = key.indexOf("\u0000");
  if (i < 0) return null;
  const wrong = key.slice(0, i);
  const right = key.slice(i + 1);
  if (!wrong || !right) return null;
  return { wrong, right };
}

export function selectedCorrectionMemoryPreviewLabels(
  rows: CorrectionMemoryEntryRow[],
  checkedKeys: Set<string>,
  max = 3,
): string[] {
  const out: string[] = [];
  for (const row of rows) {
    if (!checkedKeys.has(correctionMemoryRowKey(row))) continue;
    out.push(`${row.wrong}→${row.right}`);
    if (out.length >= max) break;
  }
  return out;
}

export function filterCorrectionMemoryRows(
  rows: CorrectionMemoryEntryRow[],
  query: string,
): CorrectionMemoryEntryRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) => r.wrong.toLowerCase().includes(q) || r.right.toLowerCase().includes(q),
  );
}
