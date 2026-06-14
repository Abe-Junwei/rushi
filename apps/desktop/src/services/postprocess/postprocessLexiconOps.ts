import type { GroundedLexiconOp } from "../../tauri/postprocessApi";
import { isPunctuationOnlyLineDiff } from "../exportPolishPipeline";

export function evidenceKindLabel(type: string): string {
  const t = type.trim().toLowerCase();
  if (t === "punctuation") return "标点";
  if (t === "rule") return "纠错记忆";
  if (t === "glossary") return "术语表";
  if (t === "inconsistent_term") return "术语统一";
  if (t === "llm_homophone" || t === "homophone") return "同音推测";
  return type;
}

export function formatStageBEvidenceSummary(evidence: { type: string; ref: string }): string {
  const kind = evidenceKindLabel(evidence.type);
  const ref = (evidence.ref ?? "").trim();
  return ref ? `${kind} · ${ref}` : kind;
}

export function parseRuleEvidenceRef(ref: string): { before: string; after: string } | null {
  const t = ref.trim();
  const arrow = t.includes("→") ? "→" : t.includes("->") ? "->" : null;
  if (!arrow) return null;
  const [before, after] = t.split(arrow).map((s) => s.trim());
  if (!before || !after || before === after) return null;
  return { before, after };
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
