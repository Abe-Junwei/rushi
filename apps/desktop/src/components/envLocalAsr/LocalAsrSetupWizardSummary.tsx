import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { formatDiskFree, type AsrSetupReport } from "../../services/asr/asrSetupContract";

export function LocalAsrSetupWizardSummary({ setupReport }: { setupReport: AsrSetupReport | null }) {
  if (!setupReport) {
    return <p className={PANEL_TYPOGRAPHY.meta}>尚未诊断。点击下方按钮开始。</p>;
  }

  return (
    <ul className={`list-none space-y-1.5 p-0 ${PANEL_TYPOGRAPHY.meta}`}>
      {setupReport.summaryLines.map((line) => (
        <li key={line} className="rounded bg-notion-callout-bg px-3 py-1.5 text-notion-text-muted">
          {line}
        </li>
      ))}
      {setupReport.diskFreeBytes != null ? (
        <li className="px-3 text-notion-text-muted">
          模型目录可用空间约 {formatDiskFree(setupReport.diskFreeBytes)}
          {setupReport.diskLow ? "（偏低）" : ""}
        </li>
      ) : null}
      {setupReport.sidecarIntegrity === "corrupt" ? (
        <li className="rounded bg-zen-cinnabar/10 px-3 py-1.5 text-zen-cinnabar">
          内置侧车包完整性异常；一键准备会尝试改用应用数据侧车恢复当前环境。
        </li>
      ) : null}
    </ul>
  );
}
