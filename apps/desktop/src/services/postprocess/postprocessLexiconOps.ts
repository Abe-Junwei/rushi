import type { GroundedLexiconOp, RefineSegmentItem } from "../../tauri/postprocessApi";

function snippetText(text: string, maxChars = 36): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "（空）";
  return t.length <= maxChars ? t : `${t.slice(0, maxChars)}…`;
}

function segmentPreviewLabel(byUid: Map<string, RefineSegmentItem>, uid: string): string {
  const s = byUid.get(uid.trim());
  if (!s) return uid.length > 12 ? `${uid.slice(0, 8)}…` : uid;
  return `[${s.startSec.toFixed(1)}–${s.endSec.toFixed(1)}s] ${snippetText(s.text)}`;
}

function evidenceKindLabel(type: string): string {
  const t = type.trim().toLowerCase();
  if (t === "rule") return "纠错记忆";
  if (t === "glossary") return "术语表";
  if (t === "inconsistent_term") return "术语统一";
  return type;
}

export function describeLexiconOpsForPreview(
  window: RefineSegmentItem[],
  items: GroundedLexiconOp[],
): string[] {
  const byUid = new Map(window.map((s) => [s.uid.trim(), s]));
  return items.map((item) => {
    const base = segmentPreviewLabel(byUid, item.uid);
    const kind = evidenceKindLabel(item.evidence.type);
    const ref = (item.evidence.ref ?? "").trim();
    return `改字 · ${base} → ${snippetText(item.text, 48)}（依据：${kind}${ref ? ` · ${ref}` : ""}）`;
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
