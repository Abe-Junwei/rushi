const CORRECTION_RULE_HINT_PREFIX = "correction_rule_hint:";

export type CorrectionRuleHintPair = {
  beforeText: string;
  afterText: string;
};

/** 从转写 warnings 解析 `correction_rule_hint:before->after`（不含其它 ASR 提示）。 */
export function parseCorrectionRuleHintsFromWarnings(warnings: string[]): CorrectionRuleHintPair[] {
  const out: CorrectionRuleHintPair[] = [];
  const seen = new Set<string>();
  for (const w of warnings) {
    if (!w.startsWith(CORRECTION_RULE_HINT_PREFIX)) continue;
    const pair = w.slice(CORRECTION_RULE_HINT_PREFIX.length);
    const [beforeText, afterText] = pair.split("->");
    if (!beforeText?.trim() || !afterText?.trim()) continue;
    const key = `${beforeText.trim()}\u0000${afterText.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ beforeText: beforeText.trim(), afterText: afterText.trim() });
  }
  return out;
}

/** A3：仅展示不会被稳定规则预览写回的 hint（避免与将应用项重复）。 */
export function filterReadOnlyCorrectionRuleHints(
  hints: CorrectionRuleHintPair[],
  stablePairs: Array<{ wrong: string; right: string }>,
): CorrectionRuleHintPair[] {
  const stableKeys = new Set(
    stablePairs.map((p) => `${p.wrong.trim()}\u0000${p.right.trim()}`),
  );
  return hints.filter((h) => !stableKeys.has(`${h.beforeText}\u0000${h.afterText}`));
}
