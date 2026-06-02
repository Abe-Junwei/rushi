import { useCallback, useState } from "react";
import * as projectApi from "../../tauri/projectApi";

export type EditLogTextChange = {
  segment_idx: number;
  uid: string;
  before: string;
  after: string;
};

export type EditLogParsedDetail = {
  op?: string;
  file_id?: string;
  count?: number;
  summary?: string;
  text_changes: EditLogTextChange[];
  correction_pairs: Array<{ before: string; after: string }>;
};

export function parseEditLogDetail(detail: string): EditLogParsedDetail | null {
  try {
    const parsed = JSON.parse(detail) as {
      op?: string;
      file_id?: string;
      count?: number;
      summary?: string;
      text_changes?: EditLogTextChange[];
      correction_pairs?: Array<{ before: string; after: string }>;
    };
    return {
      op: parsed.op,
      file_id: parsed.file_id,
      count: parsed.count,
      summary: parsed.summary,
      text_changes: Array.isArray(parsed.text_changes) ? parsed.text_changes : [],
      correction_pairs: Array.isArray(parsed.correction_pairs) ? parsed.correction_pairs : [],
    };
  } catch {
    return null;
  }
}

/** 列表主行：优先人类可读摘要，否则退回元数据。 */
export function summarizeHistoryHeadline(detail: string, kind: string): string {
  const parsed = parseEditLogDetail(detail);
  if (parsed?.summary?.trim()) {
    return parsed.summary.trim();
  }
  if (parsed) {
    const n = parsed.text_changes.length;
    if (n === 1) {
      const c = parsed.text_changes[0]!;
      return `语段 ${c.segment_idx + 1}：「${c.before}」→「${c.after}」`;
    }
    if (n > 1) {
      return `修改 ${n} 处语段正文`;
    }
    if (parsed.correction_pairs.length > 0) {
      const p = parsed.correction_pairs[0]!;
      return `纳入记忆：「${p.before}」→「${p.after}」`;
    }
    const count = Number.isFinite(parsed.count) ? `${parsed.count} 条语段` : "";
    return count ? `保存语段（${count}）` : kind;
  }
  return kind;
}

/** 次行：逐条改词（最多展示 4 条）。 */
export function formatHistorySubLines(detail: string): string[] {
  const parsed = parseEditLogDetail(detail);
  if (!parsed) return [];
  const lines: string[] = [];
  let shown = 0;
  for (const p of parsed.correction_pairs) {
    if (shown >= 4) break;
    lines.push(`记忆：「${p.before}」→「${p.after}」`);
    shown += 1;
  }
  for (const c of parsed.text_changes) {
    if (shown >= 4) break;
    lines.push(`语段 ${c.segment_idx + 1}：「${c.before}」→「${c.after}」`);
    shown += 1;
  }
  const total = parsed.text_changes.length + parsed.correction_pairs.length;
  if (total > shown) {
    lines.push(`还有 ${total - shown} 处未展开…`);
  }
  return lines;
}

/** @deprecated 使用 summarizeHistoryHeadline */
export function summarizeHistoryDetail(detail: string): string {
  return summarizeHistoryHeadline(detail, "save_segments");
}

export function useEditorEditHistory(projectId: string | undefined, projectBusy: boolean) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRows, setHistoryRows] = useState<projectApi.EditLogEntryDto[]>([]);

  const loadEditHistory = useCallback(async () => {
    if (!projectId) return;
    setHistoryBusy(true);
    setHistoryError("");
    try {
      const rows = await projectApi.projectListEditLog(projectId, 50);
      setHistoryRows(rows);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : String(e));
    } finally {
      setHistoryBusy(false);
    }
  }, [projectId]);

  const toggleHistory = useCallback(async () => {
    const nextOpen = !historyOpen;
    setHistoryOpen(nextOpen);
    if (nextOpen) {
      await loadEditHistory();
    }
  }, [historyOpen, loadEditHistory]);

  return {
    historyOpen,
    setHistoryOpen,
    historyBusy,
    historyError,
    historyRows,
    loadEditHistory,
    toggleHistory,
    historyDisabled: projectBusy || !projectId,
  };
}
