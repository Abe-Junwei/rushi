import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import {
  compareQualityReports,
  summarizeQualityReport,
  type QualityEvalReport,
} from "../services/quality/qualityEvalReport";
import {
  qualityExportCorrectionMemoryJsonl,
  qualityGetBaselineReport,
  qualityGetLastReport,
  qualityImportReportFile,
  qualityLastReportPath,
  qualityRunEval,
  qualitySetBaselineFromLast,
} from "../tauri/qualityApi";

export function useQualityEvalController() {
  const [report, setReport] = useState<QualityEvalReport | null>(null);
  const [baseline, setBaselineReport] = useState<QualityEvalReport | null>(null);
  const [reportPath, setReportPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const [last, base, path] = await Promise.all([
      qualityGetLastReport(),
      qualityGetBaselineReport(),
      qualityLastReportPath(),
    ]);
    setReport(last);
    setBaselineReport(base);
    setReportPath(path);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const summary = useMemo(
    () => (report ? summarizeQualityReport(report) : null),
    [report],
  );
  const delta = useMemo(
    () => (report ? compareQualityReports(report, baseline) : null),
    [report, baseline],
  );

  const runEval = useCallback(
    async (filterId?: string) => {
      const gate = filterId?.trim() === "proper-noun-zhikong";
      flushSync(() => {
        setBusy(true);
        setError("");
        setStatus(
          gate
            ? "R4-GATE：正在转写制控样例并计算 term_hit（约 3～15 分钟，窗口可继续浏览但请勿重复点击）…"
            : "正在运行全量 eval 批跑（条目多时可较久；ASR 须 8741 已就绪）…",
        );
      });
      try {
        const result = await qualityRunEval({
          filterId: filterId?.trim() || undefined,
          hotwordsMode: "manifest",
        });
        setReport(result.report);
        await refresh();
        setStatus(
          result.hadErrors
            ? "评测完成，部分条目失败（见下表）。"
            : "评测完成，全部条目成功。",
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        setStatus("");
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const runGateEval = useCallback(async () => {
    await runEval("proper-noun-zhikong");
  }, [runEval]);

  const importReport = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const imported = await qualityImportReportFile();
      if (!imported) {
        setStatus("");
        return;
      }
      setReport(imported);
      await refresh();
      setStatus("已导入评测报告。");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const setBaselineFromLast = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await qualitySetBaselineFromLast();
      await refresh();
      setStatus("已将当前报告设为回归基线。");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const exportMemoryJsonl = useCallback(async (redactText: boolean) => {
    setBusy(true);
    setError("");
    try {
      const path = await qualityExportCorrectionMemoryJsonl(redactText);
      if (path) {
        setStatus(
          redactText
            ? `已导出脱敏纠错记忆 JSONL：${path}`
            : `已导出纠错记忆 JSONL：${path}`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    report,
    baseline,
    reportPath,
    summary,
    delta,
    busy,
    status,
    error,
    refresh,
    runEval,
    runGateEval,
    importReport,
    setBaselineFromLast,
    exportMemoryJsonl,
  };
}
