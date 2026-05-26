import { useEffect } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { formatDiskFree } from "../../services/asr/asrSetupContract";
import type { AsrSetupControllerApi } from "../../pages/useAsrSetupController";
import { isTauriRuntime } from "../../config/env";

type Props = {
  setup: AsrSetupControllerApi;
  busy: boolean;
};

export function LocalAsrSetupWizard({ setup, busy }: Props) {
  const {
    setupReport,
    setupSteps,
    setupBusy,
    diagnoseBusy,
    setupMessage,
    portConflict,
    refreshSetupDiagnose,
    runOneClickAsrPrepare,
    acceptForeignPortService,
  } = setup;

  const wizardBusy = busy || setupBusy;
  const refreshDisabled = setupBusy || diagnoseBusy || !isTauriRuntime();

  useEffect(() => {
    if (isTauriRuntime() && !setupReport && !setupBusy && !diagnoseBusy) {
      void refreshSetupDiagnose();
    }
  }, [diagnoseBusy, refreshSetupDiagnose, setupBusy, setupReport]);

  return (
    <section className="flex flex-col gap-4">
      <div className="pb-1">
        <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>一键准备本机 ASR</h3>
        <p className={PANEL_TYPOGRAPHY.sectionDescription}>
          自动诊断并依次完成：启动内置侧车 → 检测能力 → 下载默认模型（无需终端命令）。
        </p>
      </div>

      {setupReport ? (
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
              内置侧车包完整性异常，一键准备无法修复损坏的安装包。
            </li>
          ) : null}
        </ul>
      ) : (
        <p className={PANEL_TYPOGRAPHY.meta}>尚未诊断。点击下方按钮开始。</p>
      )}

      <ol className="flex flex-col gap-2">
        {setupSteps.map((step) => (
          <li
            key={step.id}
            className="flex flex-wrap items-start gap-2 rounded bg-notion-sidebar px-3 py-2"
          >
            <StepDot status={step.status} />
            <div className="min-w-0 flex-1">
              <span className={PANEL_TYPOGRAPHY.fieldLabel}>{step.label}</span>
              {step.detail ? (
                <p className="mt-0.5 text-[11px] text-notion-text-muted">{step.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={CONTROL_BTN_PRIMARY}
          disabled={wizardBusy || !isTauriRuntime()}
          onClick={() => void runOneClickAsrPrepare()}
        >
          {setupBusy ? "准备中…" : "一键准备本机 ASR"}
        </button>
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={refreshDisabled}
          onClick={() => void refreshSetupDiagnose()}
        >
          {diagnoseBusy ? "诊断中…" : "刷新诊断"}
        </button>
      </div>

      {portConflict ? (
        <div className="rounded border border-notion-divider bg-notion-callout-bg px-3 py-2 text-sm text-notion-text">
          <p className="font-medium text-notion-text">8741 端口冲突</p>
          <p className="mt-1 text-notion-text-muted">
            若该端口已是本机另一实例的 rushi-asr，可尝试使用当前服务；否则请先结束占用进程后再点一键准备。
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              disabled={wizardBusy}
              onClick={() => void acceptForeignPortService()}
            >
              尝试使用当前服务
            </button>
          </div>
        </div>
      ) : null}

      {setupMessage ? (
        <p
          className={`text-sm ${setupMessage.includes("完成") ? "text-zen-success" : "text-notion-text-muted"}`}
          role="status"
        >
          {setupMessage}
        </p>
      ) : null}
    </section>
  );
}

function StepDot({ status }: { status: string }) {
  const cls =
    status === "ok"
      ? "bg-zen-success"
      : status === "running"
        ? "bg-zen-saffron"
        : status === "error"
          ? "bg-zen-cinnabar"
          : status === "skipped"
            ? "bg-notion-text-light"
            : "bg-notion-divider";
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cls}`} aria-hidden />;
}
