import { useEffect, useRef } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { AsrSetupControllerApi } from "../../pages/useAsrSetupController";
import { isTauriRuntime } from "../../config/env";
import { LocalAsrRuntimeInstallPanel } from "./LocalAsrRuntimeInstallPanel";
import { LocalAsrSetupWizardSummary } from "./LocalAsrSetupWizardSummary";

type Props = {
  setup: AsrSetupControllerApi;
  busy: boolean;
  prepareModelBusy?: boolean;
  openAppDataFolder: () => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
};

export function LocalAsrSetupWizard({
  setup,
  busy,
  prepareModelBusy = false,
  openAppDataFolder,
  exportDiagnosticBundle,
}: Props) {
  const {
    setupReport,
    localRuntimeDiag,
    setupSteps,
    setupBusy,
    diagnoseBusy,
    setupMessage,
    setupOutcome,
    portConflict,
    refreshSetupDiagnose,
    refreshLocalRuntimeDiagnose,
    downloadLocalRuntime,
    cancelLocalRuntime,
    revalidateLocalRuntime,
    clearLocalRuntime,
    restorePreviousLocalRuntime,
    runOneClickAsrPrepare,
    acceptForeignPortService,
  } = setup;

  const wizardBusy = busy || setupBusy || diagnoseBusy || prepareModelBusy;
  const refreshDisabled = setupBusy || diagnoseBusy || !isTauriRuntime();
  const initialDiagnoseTriggeredRef = useRef(false);

  useEffect(() => {
    if (isTauriRuntime() && !initialDiagnoseTriggeredRef.current && !setupReport && !setupBusy && !diagnoseBusy) {
      initialDiagnoseTriggeredRef.current = true;
      void refreshSetupDiagnose({ resetSteps: false, touchUi: false });
    }
  }, [diagnoseBusy, refreshSetupDiagnose, setupBusy, setupReport]);

  return (
    <section className="flex flex-col gap-4">
      <div className="pb-1">
        <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>一键准备本机 ASR</h3>
        <p className={PANEL_TYPOGRAPHY.sectionDescription}>
          自动诊断并依次完成：启动内置侧车 → 检测能力 → 下载当前所选模型（无需终端命令）。
        </p>
      </div>

      <LocalAsrSetupWizardSummary setupReport={setupReport} />

      {localRuntimeDiag ? (
        <LocalAsrRuntimeInstallPanel
          localRuntimeDiag={localRuntimeDiag}
          wizardBusy={wizardBusy}
          downloadLocalRuntime={downloadLocalRuntime}
          cancelLocalRuntime={cancelLocalRuntime}
          refreshLocalRuntimeDiagnose={refreshLocalRuntimeDiagnose}
          revalidateLocalRuntime={revalidateLocalRuntime}
          clearLocalRuntime={clearLocalRuntime}
          restorePreviousLocalRuntime={restorePreviousLocalRuntime}
          openAppDataFolder={openAppDataFolder}
          exportDiagnosticBundle={exportDiagnosticBundle}
        />
      ) : null}

      <ol className="flex flex-col gap-2">
        {setupSteps.map((step) => (
          <li
            key={step.id}
            className="flex flex-wrap items-start gap-2 rounded bg-notion-sidebar px-3 py-2"
          >
            <SetupStepDot status={step.status} />
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
          className={`text-sm ${
            setupOutcome === "ready"
              ? "text-zen-success"
              : setupOutcome === "error" || setupOutcome === "blocked"
                ? "text-zen-cinnabar"
                : "text-notion-text-muted"
          }`}
          role="status"
        >
          {setupMessage}
        </p>
      ) : null}
    </section>
  );
}

function SetupStepDot({ status }: { status: string }) {
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
