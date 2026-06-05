import type { CorrectionMemoryEntryRow } from "../../tauri/correctionApi";

/** 与 Rust `CORRECTION_MEMORY_STABLE_HIT` 一致。 */
export const CORRECTION_MEMORY_STABLE_HIT = 3;

export type LearningCorrectionHint = {
  beforeText: string;
  afterText: string;
  hitCount: number;
};

function pairKey(wrong: string, right: string): string {
  return `${wrong.trim()}\u0000${right.trim()}`;
}

/** 学习中（未满 3 次且未采纳）且当前稿仍含错形的记忆，供阶段 A 只读展示。 */
export function listLearningCorrectionHintsForSegments(
  entries: CorrectionMemoryEntryRow[],
  stablePairs: Array<{ wrong: string; right: string }>,
  segments: Array<{ text: string }>,
): LearningCorrectionHint[] {
  const stableKeys = new Set(stablePairs.map((p) => pairKey(p.wrong, p.right)));
  const seen = new Set<string>();
  const out: LearningCorrectionHint[] = [];

  for (const e of entries) {
    if (e.acceptedAsRule || e.hitCount >= CORRECTION_MEMORY_STABLE_HIT) continue;
    const wrong = e.wrong.trim();
    const right = e.right.trim();
    if (!wrong || !right || wrong === right) continue;
    const key = pairKey(wrong, right);
    if (stableKeys.has(key) || seen.has(key)) continue;
    const matches = segments.some((s) => s.text.includes(wrong) && !s.text.includes(right));
    if (!matches) continue;
    seen.add(key);
    out.push({ beforeText: wrong, afterText: right, hitCount: e.hitCount });
  }

  return out.sort((a, b) => b.hitCount - a.hitCount || a.beforeText.localeCompare(b.beforeText, "zh"));
}

export function formatLearningCorrectionHintLabel(hint: LearningCorrectionHint): string {
  return `「${hint.beforeText}」→「${hint.afterText}」（学习中 ${hint.hitCount}/${CORRECTION_MEMORY_STABLE_HIT} 次，预览不会自动写回）`;
}
