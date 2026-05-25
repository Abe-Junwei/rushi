import { useCallback, useState } from "react";
import * as projectApi from "../../tauri/projectApi";

export function summarizeHistoryDetail(detail: string): string {
  try {
    const parsed = JSON.parse(detail) as { op?: string; file_id?: string; count?: number };
    const op = parsed.op ? `操作: ${parsed.op}` : "";
    const count = Number.isFinite(parsed.count) ? `条目: ${parsed.count}` : "";
    const file = parsed.file_id ? `文件: ${parsed.file_id.slice(0, 8)}` : "";
    const summary = [op, count, file].filter(Boolean).join(" · ");
    return summary || detail;
  } catch {
    return detail;
  }
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
