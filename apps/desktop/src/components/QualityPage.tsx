import { useCallback, useState } from "react";
import {
  BarChart3,
  Download,
  FileUp,
  Play,
  RefreshCw,
  Target,
} from "lucide-react";
import {
  CONTROL_BTN_GHOST,
  CONTROL_BTN_PRIMARY,
  CONTROL_BTN_SECONDARY,
} from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { useQualityEvalController } from "../pages/useQualityEvalController";
import { packagedOrDev } from "../services/packagedUserHints";
import {
  formatFinishedAt,
  formatQualityCer,
  formatQualityPct,
} from "../services/quality/qualityEvalReport";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type QualityPageProps = {
  busy: boolean;
};

export function QualityPage({ busy: appBusy }: QualityPageProps) {
  const q = useQualityEvalController();
  const disabled = appBusy || q.busy;
  const [exportRedact, setExportRedact] = useState(true);

  const handleExportMemory = useCallback(() => {
    const ok = window.confirm(
      exportRedact
        ? "将导出脱敏 JSONL（仅保留字数，不含原文）。继续？"
        : "将导出完整纠错记忆原文。仅用于本地分析，请勿分享未脱敏文件。继续？",
    );
    if (!ok) return;
    void q.exportMemoryJsonl(exportRedact);
  }, [exportRedact, q]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-10 py-8">
      {q.busy ? (
        <div
          className="pointer-events-none absolute inset-0 z-20 flex items-start justify-center bg-notion-bg/55 pt-24"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto max-w-md rounded-lg border border-notion-border bg-notion-bg px-5 py-4 shadow-sm">
            <p className={`m-0 ${PANEL_TYPOGRAPHY.sectionTitle}`}>评测进行中</p>
            <p className={`m-0 mt-2 ${PANEL_TYPOGRAPHY.helper}`}>
              {q.status || "请稍候…"}
            </p>
          </div>
        </div>
      ) : null}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-notion-text">
          <BarChart3
            className={LUCIDE_ICON_SIZE_MD}
            strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
            aria-hidden
          />
          <h1 className={PANEL_TYPOGRAPHY.envPageTitle}>质量概览</h1>
        </div>
        <p className={`max-w-2xl ${PANEL_TYPOGRAPHY.sectionDescription}`}>
          R4：展示最近一次 eval 批跑摘要（CER / 术语命中）。发版前请运行 R4-GATE（制控专名样例）并可选设定回归基线。
        </p>
      </header>

      <section className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={CONTROL_BTN_PRIMARY}
          disabled={disabled}
          onClick={() => void q.runEval()}
        >
          <Play className="h-4 w-4 shrink-0" aria-hidden />
          运行全量 eval
        </button>
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={disabled}
          onClick={() => void q.runGateEval()}
        >
          <Target className="h-4 w-4 shrink-0" aria-hidden />
          R4-GATE（制控专名）
        </button>
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={disabled}
          onClick={() => void q.importReport()}
        >
          <FileUp className="h-4 w-4 shrink-0" aria-hidden />
          导入报告 JSON
        </button>
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={disabled || !q.report}
          onClick={() => void q.setBaselineFromLast()}
        >
          设为回归基线
        </button>
        <button
          type="button"
          className={CONTROL_BTN_GHOST}
          disabled={disabled}
          onClick={() => void q.refresh()}
        >
          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
          刷新
        </button>
      </section>

      {q.status ? (
        <p className={`${PANEL_TYPOGRAPHY.helper} text-zen-saffron-mid`}>{q.status}</p>
      ) : null}
      {q.error ? (
        <p className={`${PANEL_TYPOGRAPHY.helper} text-cinnabar`} role="alert">
          {q.error}
        </p>
      ) : null}

      {q.summary ? (
        <section className="grid gap-4 rounded-lg bg-notion-callout-bg p-4 md:grid-cols-2 lg:grid-cols-4">
          <Metric label="评测条目" value={String(q.summary.itemCount)} />
          <Metric label="平均 CER" value={formatQualityCer(q.summary.meanCer)} />
          <Metric
            label="平均术语命中"
            value={formatQualityPct(q.summary.meanTermHit)}
          />
          <Metric
            label={`门禁 ${q.summary.gateItemId}`}
            value={formatQualityPct(q.summary.gateTermHit)}
          />
          {q.delta ? (
            <>
              <Metric
                label="Δ 平均 CER（相对基线）"
                value={
                  q.delta.meanCerDelta != null
                    ? (q.delta.meanCerDelta >= 0 ? "+" : "") +
                      q.delta.meanCerDelta.toFixed(4)
                    : "—"
                }
              />
              <Metric
                label="Δ 制控 term_hit"
                value={
                  q.delta.gateTermHitDelta != null
                    ? (q.delta.gateTermHitDelta >= 0 ? "+" : "") +
                      (q.delta.gateTermHitDelta * 100).toFixed(1) +
                      " pp"
                    : "—"
                }
              />
            </>
          ) : null}
          <Metric
            label="完成时间"
            value={formatFinishedAt(q.report?.finishedAtMs)}
          />
          <Metric label="失败条目" value={String(q.summary.errorCount)} />
        </section>
      ) : (
        <p className={PANEL_TYPOGRAPHY.helper}>
          尚无评测报告。请确保本机 ASR（127.0.0.1:8741）已就绪，
          {packagedOrDev(
            "或在仓库根执行 npm run eval:run 后导入 JSON。",
            "或在应用内运行评测后导入 JSON。",
          )}
        </p>
      )}

      {q.reportPath ? (
        <p className={`break-all ${PANEL_TYPOGRAPHY.meta}`}>
          报告路径：{q.reportPath}
        </p>
      ) : null}

      {q.report && q.report.items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg bg-notion-sidebar">
          <table className="w-full min-w-[32rem] text-left text-sm text-notion-text">
            <thead className="border-b border-notion-divider text-notion-text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">CER</th>
                <th className="px-3 py-2 font-medium">term_hit</th>
                <th className="px-3 py-2 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {q.report.items.map((it) => (
                <tr
                  key={`${it.id}-${it.error ?? ""}-${it.skipped ?? ""}`}
                  className="border-b border-notion-divider/60"
                >
                  <td className="px-3 py-2 font-mono text-xs">{it.id}</td>
                  <td className="px-3 py-2">{formatQualityCer(it.cerChars ?? null)}</td>
                  <td className="px-3 py-2">
                    {formatQualityPct(it.termHitRate ?? null)}
                  </td>
                  <td className="px-3 py-2 text-notion-text-muted">
                    {it.error ?? it.skipped ?? "ok"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <section className="flex flex-col gap-3 border-t border-notion-divider pt-6">
        <h2 className={PANEL_TYPOGRAPHY.sectionTitle}>纠错记忆导出（R4）</h2>
        <label className="flex items-center gap-2 text-sm text-notion-text">
          <input
            type="checkbox"
            checked={exportRedact}
            onChange={(e) => setExportRedact(e.target.checked)}
            disabled={disabled}
          />
          导出时脱敏（不写入原文，仅字数）
        </label>
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={disabled}
          onClick={handleExportMemory}
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          导出 correction_memory JSONL
        </button>
      </section>

      <p className={`${PANEL_TYPOGRAPHY.meta} text-notion-text-light`}>
        {packagedOrDev(
          "终端等价命令：npm run eval:run · npm run eval:run:hotwords-on --filter-id proper-noun-zhikong",
          "发版包请使用应用内「运行评测」与报告导入。",
        )}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={PANEL_TYPOGRAPHY.meta}>{label}</span>
      <span className="text-lg font-medium text-notion-text">{value}</span>
    </div>
  );
}
