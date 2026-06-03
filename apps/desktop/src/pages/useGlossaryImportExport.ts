import { useCallback, useState } from "react";
import { splitGlossaryPasteInput } from "../services/glossaryPasteSplit";
import { buildGlossaryCsvExport } from "../services/glossaryTermHelpers";
import { isTauriRuntime } from "../config/env";
import type { GlossaryTermDto } from "../tauri/glossaryApi";
import * as g from "../tauri/glossaryApi";
import type { GlossaryImportResult } from "../tauri/glossaryApi";
import { exportTextFile } from "../tauri/projectApi";

function glossaryImportSkipSuffix(result: GlossaryImportResult): string {
  const parts: string[] = [];
  if (result.skippedDup > 0) parts.push(`${result.skippedDup} 条重复已跳过`);
  if (result.skippedWrongForm > 0) {
    parts.push(`${result.skippedWrongForm} 条纠错错形已跳过（请用正形作主术语）`);
  }
  return parts.length > 0 ? `，${parts.join("，")}` : "";
}

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
      const skip = glossaryImportSkipSuffix(result);
      if (result.added > 0) {
        setStatusMessage(`批量添加 ${result.added} 条${skip}。`);
      } else if (result.skippedDup > 0 && result.skippedWrongForm === 0) {
        setError("所选术语均已存在（忽略大小写）。");
      } else if (result.skippedWrongForm > 0) {
        setError(
          result.skippedDup > 0
            ? "未添加新术语：均为重复或纠错记忆中的错形（术语表请填正形）。"
            : "未添加：所列词条为纠错记忆中的错形，请使用正形作为主术语。",
        );
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
        `已从表格导入 ${result.added} 条（识别 ${result.parsed} 行${glossaryImportSkipSuffix(result)}；含 hotword_enabled 列时按列导入）。`,
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
