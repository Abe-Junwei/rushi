import { useCallback, useState } from "react";
import { splitGlossaryPasteInput } from "../services/glossaryPasteSplit";
import { buildGlossaryCsvExport } from "../services/glossaryTermHelpers";
import { isTauriRuntime } from "../config/env";
import type { GlossaryTermDto } from "../tauri/glossaryApi";
import * as g from "../tauri/glossaryApi";
import { exportTextFile } from "../tauri/projectApi";

export function useGlossaryImportExport(
  terms: GlossaryTermDto[],
  refresh: () => Promise<void>,
  setError: (msg: string) => void,
  setStatusMessage: (msg: string) => void,
  setBusy: (busy: boolean) => void,
) {
  const [bulkPaste, setBulkPaste] = useState("");

  const bulkAdd = useCallback(async () => {
    const pieces = splitGlossaryPasteInput(bulkPaste);
    if (pieces.length === 0) return;
    setBusy(true);
    setError("");
    setStatusMessage("");
    try {
      const result = await g.glossaryAddBatch(pieces, true);
      setBulkPaste("");
      await refresh();
      if (result.added > 0) {
        setStatusMessage(
          `批量添加 ${result.added} 条${result.skippedDup ? `，${result.skippedDup} 条重复已跳过` : ""}。`,
        );
      } else if (result.skippedDup > 0) {
        setError("所选术语均已存在（忽略大小写）。");
      } else {
        setError("未添加任何术语。");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [bulkPaste, refresh, setBusy, setError, setStatusMessage]);

  const importFromFile = useCallback(async () => {
    if (!isTauriRuntime()) {
      setError("浏览器预览无法导入表格，请在桌面应用中操作。");
      return;
    }
    setBusy(true);
    setError("");
    setStatusMessage("");
    try {
      const result = await g.glossaryImportFromFile();
      if (result == null) return;
      await refresh();
      setStatusMessage(
        `已从表格导入 ${result.added} 条（识别 ${result.parsed} 行${result.skippedDup ? `，${result.skippedDup} 条重复已跳过` : ""}；含 hotword_enabled 列时按列导入）。`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [refresh, setBusy, setError, setStatusMessage]);

  const exportCsv = useCallback(async () => {
    if (!isTauriRuntime()) {
      setError("浏览器预览无法导出，请在桌面应用中操作。");
      return;
    }
    if (terms.length === 0) {
      setError("暂无术语可导出。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const content = buildGlossaryCsvExport(terms);
      const saved = await exportTextFile("glossary-export.csv", content);
      if (saved) {
        setStatusMessage(`已导出至 ${saved}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [terms, setBusy, setError, setStatusMessage]);

  return { bulkPaste, setBulkPaste, bulkAdd, importFromFile, exportCsv };
}
