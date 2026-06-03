import { extractSingleTextDiffParts } from "../utils/textDiff";
import { joinSegmentTextsForExportPolish } from "./exportDocxPolish.helpers";

const EXCERPT_MAX = 120;
const LINE_CAP = 48;

function excerpt(s: string, max = EXCERPT_MAX): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export type ExportPolishEditLogDetail = {
  op: "export_llm_polish";
  file_id: string;
  summary: string;
  paragraph_count_before: number;
  paragraph_count_after: number;
  text_changes: Array<{
    segment_idx: number;
    uid: string;
    before: string;
    after: string;
  }>;
};

export function buildExportPolishEditLogDetail(
  fileId: string,
  segmentTexts: string[],
  polishedParagraphs: string[],
): ExportPolishEditLogDetail {
  const before = joinSegmentTextsForExportPolish(
    segmentTexts.map((text, idx) => ({ text, idx, start_sec: 0, end_sec: 0, low_confidence: false })),
  );
  const after = polishedParagraphs.join("\n\n");
  const segCount = segmentTexts.filter((t) => t.trim()).length;
  return {
    op: "export_llm_polish",
    file_id: fileId,
    summary: `导出大模型润色：${segCount} 条语段 → ${polishedParagraphs.length} 个自然段`,
    paragraph_count_before: segCount,
    paragraph_count_after: polishedParagraphs.length,
    text_changes: [
      {
        segment_idx: 0,
        uid: "",
        before: before.length > 4000 ? `${before.slice(0, 4000)}…` : before,
        after: after.length > 4000 ? `${after.slice(0, 4000)}…` : after,
      },
    ],
  };
}

/** Word 附录 + 历史摘要用的纯文本行。 */
export function buildExportPolishRevisionLines(
  segmentTexts: string[],
  polishedParagraphs: string[],
): string[] {
  const before = joinSegmentTextsForExportPolish(
    segmentTexts.map((text) => ({ text, start_sec: 0, end_sec: 0, idx: 0, low_confidence: false })),
  );
  const after = polishedParagraphs.join("\n\n");
  if (before === after) {
    return ["润色后与导出前正文一致（无可见改动）。"];
  }

  const lines: string[] = [];
  const segCount = segmentTexts.filter((t) => t.trim()).length;
  lines.push(`语段 ${segCount} 条 → 润色后 ${polishedParagraphs.length} 个自然段。`);

  const parts = extractSingleTextDiffParts(before, after);
  if (parts && (parts.removed || parts.inserted)) {
    lines.push(
      `全文差异：删「${excerpt(parts.removed)}」/ 增「${excerpt(parts.inserted)}」`,
    );
  }

  const maxPara = Math.min(
    Math.max(segCount, polishedParagraphs.length),
    12,
  );
  for (let i = 0; i < maxPara; i += 1) {
    const b = (segmentTexts[i] ?? "").trim();
    const a = (polishedParagraphs[i] ?? "").trim();
    if (!b && !a) continue;
    if (b === a) continue;
    lines.push(`第 ${i + 1} 段：「${excerpt(b, 60)}」→「${excerpt(a, 60)}」`);
    if (lines.length >= LINE_CAP) {
      lines.push("…（更多修订行已省略）");
      break;
    }
  }

  return lines.slice(0, LINE_CAP);
}
