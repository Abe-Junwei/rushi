import {
  editLogAppliesToFile,
  formatHistorySubLines,
  summarizeHistoryHeadline,
} from "../components/editor/useEditorEditHistory";
import type { EditLogEntryDto } from "../tauri/projectApi";

/** 与 Rust `MAX_APPENDIX_LINES` 对齐。 */
const APPENDIX_MAX_ROWS = 30;
const APPENDIX_MAX_LINES = 120;

function formatEditLogWhen(atMs: number): string {
  try {
    return new Date(atMs).toLocaleString("zh-CN", { hour12: false });
  } catch {
    return String(atMs);
  }
}

/** 为 Word 修订摘要附录生成纯文本行（不含 Track Changes）。 */
export function buildDeliveryExportAppendixLines(
  rows: EditLogEntryDto[],
  fileId: string | undefined,
): string[] {
  if (!fileId) return [];
  const lines: string[] = [];
  for (const row of rows) {
    if (!editLogAppliesToFile(row, fileId)) continue;
    if (row.kind === "project_import") continue;
    const when = formatEditLogWhen(row.at_ms);
    const headline = summarizeHistoryHeadline(row.detail, row.kind);
    lines.push(`${when} · ${headline}`);
    for (const sub of formatHistorySubLines(row.detail)) {
      lines.push(`  ${sub}`);
    }
    if (lines.length >= APPENDIX_MAX_ROWS * 3) break;
  }
  return lines.slice(0, APPENDIX_MAX_LINES);
}

export type DocxProjectMetadata = {
  narrator?: string | null;
  recorded_at?: string | null;
  location?: string | null;
  subject?: string | null;
  transcriber?: string | null;
};

const DOCX_METADATA_FIELDS: ReadonlyArray<{ key: keyof DocxProjectMetadata; label: string }> = [
  { key: "narrator", label: "讲述人" },
  { key: "recorded_at", label: "时间" },
  { key: "location", label: "地点" },
  { key: "subject", label: "主题" },
  { key: "transcriber", label: "转录人" },
];

export type DocxProjectMetadataPreviewLine = {
  label: string;
  value: string;
};

/** 交付导出对话框：展示将写入 Word 的已填场次字段（不含导出行）。 */
export function listDocxProjectMetadataPreviewLines(
  metadata?: DocxProjectMetadata,
): DocxProjectMetadataPreviewLine[] {
  const lines: DocxProjectMetadataPreviewLine[] = [];
  for (const { key, label } of DOCX_METADATA_FIELDS) {
    const value = metadata?.[key]?.trim();
    if (value) lines.push({ label, value });
  }
  return lines;
}

/** Word 封面抬头：导出行；勾选「附带场次信息」时再追加 P0 元信息行（Rust 侧按行渲染）。 */
export function buildDocxExportMetaLine(
  documentTitle: string,
  exportedAt = new Date(),
  options?: { includeProjectMetadata?: boolean; metadata?: DocxProjectMetadata },
): string {
  const when = exportedAt.toLocaleString("zh-CN", { hour12: false });
  const title = documentTitle.trim() || "未命名";
  const lines = [`导出：${title} · ${when}`];
  if (options?.includeProjectMetadata) {
    for (const { key, label } of DOCX_METADATA_FIELDS) {
      const value = options.metadata?.[key]?.trim();
      if (value) lines.push(`${label}：${value}`);
    }
  }
  return lines.join("\n");
}
