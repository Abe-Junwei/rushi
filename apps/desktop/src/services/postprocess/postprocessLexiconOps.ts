import type { GroundedLexiconOp, RefineSegmentItem } from "../../tauri/postprocessApi";
import { isPunctuationOnlyLineDiff } from "../exportPolishPipeline";

function snippetText(text: string, maxChars = 36): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "（空）";
  return t.length <= maxChars ? t : `${t.slice(0, maxChars)}…`;
}

export function evidenceKindLabel(type: string): string {
  const t = type.trim().toLowerCase();
  if (t === "punctuation") return "标点";
  if (t === "rule") return "纠错记忆";
  if (t === "glossary") return "术语表";
  if (t === "inconsistent_term") return "术语统一";
  return type;
}

export function formatStageBEvidenceSummary(evidence: { type: string; ref: string }): string {
  const kind = evidenceKindLabel(evidence.type);
  const ref = (evidence.ref ?? "").trim();
  return ref ? `${kind} · ${ref}` : kind;
}

export function describeLexiconOpsForPreview(
  window: RefineSegmentItem[],
  items: GroundedLexiconOp[],
): string[] {
  const byUid = new Map(window.map((s) => [s.uid.trim(), s]));
  return items.map((item) => {
    const s = byUid.get(item.uid.trim());
    const base = s
      ? `[${s.startSec.toFixed(1)}–${s.endSec.toFixed(1)}s] ${snippetText(s.text)}`
      : item.uid.length > 12
        ? `${item.uid.slice(0, 8)}…`
        : item.uid;
    return `改字 · ${base} → ${snippetText(item.text, 48)}（依据：${formatStageBEvidenceSummary(item.evidence)}）`;
  });
}

export function parseRuleEvidenceRef(ref: string): { before: string; after: string } | null {
  const t = ref.trim();
  const arrow = t.includes("→") ? "→" : t.includes("->") ? "->" : null;
  if (!arrow) return null;
  const [before, after] = t.split(arrow).map((s) => s.trim());
  if (!before || !after || before === after) return null;
  return { before, after };
}

export function rulePairsFromLexiconItems(items: GroundedLexiconOp[]): Array<{ before: string; after: string }> {
  const out: Array<{ before: string; after: string }> = [];
  for (const item of items) {
    if (item.evidence.type !== "rule") continue;
    const pair = parseRuleEvidenceRef(item.evidence.ref);
    if (pair) out.push(pair);
  }
  return out;
}

export function classifyStageBEvidenceFlags(evidence: { type: string; ref: string }): {
  punctuateTouched: boolean;
  typoTouched: boolean;
} {
  const t = evidence.type.trim().toLowerCase();
  return {
    punctuateTouched: t === "punctuation",
    typoTouched: t !== "punctuation",
  };
}

/** 预览标签以 diff 为准，避免 LLM 错标 evidence.type 时显示「改字」。 */
export function classifyStageBSegmentChangeFlags(
  beforeText: string,
  afterText: string,
  evidenceItems: GroundedLexiconOp[],
): {
  punctuateTouched: boolean;
  typoTouched: boolean;
  evidenceSummary: string | null;
} {
  const punctOnly = isPunctuationOnlyLineDiff(beforeText, afterText);
  const summaries: string[] = [];
  for (const item of evidenceItems) {
    const evidenceType = item.evidence.type.trim().toLowerCase();
    const isPunctEvidence = evidenceType === "punctuation";
    if (punctOnly && !isPunctEvidence) continue;
    if (!punctOnly && isPunctEvidence) continue;
    summaries.push(formatStageBEvidenceSummary(item.evidence));
  }
  return {
    punctuateTouched: punctOnly,
    typoTouched: !punctOnly && beforeText !== afterText,
    evidenceSummary: summaries.length ? summaries.join("；") : null,
  };
}
