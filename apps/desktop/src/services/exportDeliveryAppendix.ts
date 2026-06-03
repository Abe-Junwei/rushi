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

export function buildDocxExportMetaLine(projectTitle: string, exportedAt = new Date()): string {
  const when = exportedAt.toLocaleString("zh-CN", { hour12: false });
  const title = projectTitle.trim() || "未命名";
  return `导出：${title} · ${when}`;
}
