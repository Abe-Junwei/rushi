import { useCallback, useState } from "react";
import * as projectApi from "../../tauri/projectApi";
import type { EditLogEntryDto } from "../../tauri/projectApi";

export type EditLogTextChange = {
  segment_idx: number;
  uid: string;
  before: string;
  after: string;
};

export type EditLogParsedDetail = {
  op?: string;
  file_id?: string;
  source_edit_log_id?: number;
  source_summary?: string;
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
      source_edit_log_id?: number;
      source_summary?: string;
      count?: number;
      summary?: string;
      text_changes?: EditLogTextChange[];
      correction_pairs?: Array<{ before: string; after: string }>;
    };
    return {
      op: parsed.op,
      file_id: parsed.file_id,
      source_edit_log_id: parsed.source_edit_log_id,
      source_summary: parsed.source_summary,
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
      const c = parsed.text_changes[0];
      return `语段 ${c.segment_idx + 1}：「${c.before}」→「${c.after}」`;
    }
    if (n > 1) {
      return `修改 ${n} 处语段正文`;
    }
    if (parsed.correction_pairs.length > 0) {
      const p = parsed.correction_pairs[0];
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
  if (parsed.op === "restore_from_edit_log" && parsed.source_summary?.trim()) {
    lines.push(`目标版本：${parsed.source_summary.trim()}`);
  }
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

export function editLogAppliesToFile(row: EditLogEntryDto, fileId: string | undefined): boolean {
  if (!fileId) return false;
  const parsed = parseEditLogDetail(row.detail);
  return parsed?.file_id === fileId;
}

export function canRestoreEditLogRow(
  row: EditLogEntryDto,
  fileId: string | undefined,
  projectBusy: boolean,
): boolean {
  if (projectBusy || !fileId || !row.has_snapshot) return false;
  if (row.kind !== "save_segments" && row.kind !== "restore_from_edit_log") return false;
  return editLogAppliesToFile(row, fileId);
}

/** @deprecated 使用 summarizeHistoryHeadline */
export function summarizeHistoryDetail(detail: string): string {
  return summarizeHistoryHeadline(detail, "save_segments");
}

type UseEditorEditHistoryArgs = {
  projectId: string | undefined;
  fileId: string | undefined;
  projectBusy: boolean;
  onRestoreVersion?: (editLogId: number) => Promise<void>;
};

export function useEditorEditHistory({
  projectId,
  fileId,
  projectBusy,
  onRestoreVersion,
}: UseEditorEditHistoryArgs) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRows, setHistoryRows] = useState<projectApi.EditLogEntryDto[]>([]);
  const [restoreTarget, setRestoreTarget] = useState<EditLogEntryDto | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);

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

  const requestRestore = useCallback((row: EditLogEntryDto) => {
    if (!canRestoreEditLogRow(row, fileId, projectBusy)) return;
    setRestoreTarget(row);
  }, [fileId, projectBusy]);

  const cancelRestore = useCallback(() => {
    if (!restoreBusy) setRestoreTarget(null);
  }, [restoreBusy]);

  const confirmRestore = useCallback(async () => {
    if (!restoreTarget || !onRestoreVersion) return;
    setRestoreBusy(true);
    setHistoryError("");
    try {
      await onRestoreVersion(restoreTarget.id);
      setRestoreTarget(null);
      await loadEditHistory();
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : String(e));
    } finally {
      setRestoreBusy(false);
    }
  }, [restoreTarget, onRestoreVersion, loadEditHistory]);

  return {
    historyOpen,
    setHistoryOpen,
    historyBusy,
    historyError,
    historyRows,
    loadEditHistory,
    toggleHistory,
    historyDisabled: projectBusy || !projectId,
    restoreTarget,
    restoreBusy,
    requestRestore,
    cancelRestore,
    confirmRestore,
    canRestoreRow: (row: EditLogEntryDto) => canRestoreEditLogRow(row, fileId, projectBusy),
  };
}
