import { useEffect, useRef } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { toast } from "../../services/ui/toast";
import { resolveSetupWizardToast } from "../../services/asr/setupWizardToastPolicy";
import type { AsrSetupControllerApi } from "../../pages/useAsrSetupController";
import { isTauriRuntime } from "../../config/env";
import { buildDiskMetaLine, isExternalSidecarSatisfyingSetup } from "../../services/asr/localAsrSetupWizardPresentation";
import { EnvUtilitiesActionRow } from "./envLocalAsrPanelUi";
import { LocalAsrRuntimeInstallPanel } from "./LocalAsrRuntimeInstallPanel";
import { LocalAsrSetupStepList } from "./LocalAsrSetupStepList";

type Props = {
  setup: AsrSetupControllerApi;
  busy: boolean;
  prepareModelBusy?: boolean;
  prepareModelCancelling?: boolean;
  transcribeBlockReason?: string | null;
  selectedModelReady?: boolean;
  openAppDataFolder: () => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
  /** 折叠区内：外层已有「安装向导」标题 */
  embedded?: boolean;
  /** 错误态主区：标题与说明、主操作与反馈与全量向导一致；省略步骤列表与侧车折叠 */
  compact?: boolean;
};

export function LocalAsrSetupWizard({
  setup,
  busy,
  prepareModelBusy = false,
  prepareModelCancelling = false,
  transcribeBlockReason = null,
  selectedModelReady = false,
  openAppDataFolder,
  exportDiagnosticBundle,
  embedded = false,
  compact = false,
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
  const lastSetupToastRef = useRef<string | null>(null);
  const diskMeta = buildDiskMetaLine(setupReport);

  useEffect(() => {
    if (!setupMessage || setupMessage === lastSetupToastRef.current) return;
    const resolved = resolveSetupWizardToast({
      setupMessage,
      setupOutcome,
      prepareModelBusy,
      prepareModelCancelling,
      transcribeBlockReason,
    });
    if (!resolved.emit) return;
    lastSetupToastRef.current = setupMessage;
    switch (resolved.variant) {
      case "success":
        toast.success(resolved.message);
        break;
      case "error":
        toast.error(resolved.message);
        break;
      case "warning":
        toast.warning(resolved.message);
        break;
      default:
        toast.info(resolved.message);
        break;
    }
  }, [
    setupMessage,
    setupOutcome,
    prepareModelBusy,
    prepareModelCancelling,
    transcribeBlockReason,
  ]);

  return (
    <section className="flex flex-col gap-3">
      {embedded ? (
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>自动完成侧车、能力检测与模型下载。</p>
      ) : null}

      <EnvUtilitiesActionRow>
        <button
          type="button"
          className={CONTROL_BTN_PRIMARY}
          disabled={wizardBusy || !isTauriRuntime()}
          onClick={() => void runOneClickAsrPrepare()}
        >
          {setupBusy ? "准备中…" : "一键准备"}
        </button>
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={refreshDisabled}
          onClick={() => void refreshSetupDiagnose()}
        >
          {diagnoseBusy ? "诊断中…" : "刷新诊断"}
        </button>
        {portConflict ? (
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={wizardBusy}
            onClick={() => void acceptForeignPortService()}
          >
            使用当前 8741 服务
          </button>
        ) : null}
      </EnvUtilitiesActionRow>

      {!setupReport ? (
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>尚未诊断；可先刷新环境，或直接一键准备。</p>
      ) : null}

      {!compact ? <LocalAsrSetupStepList steps={setupSteps} /> : null}

      {portConflict ? (
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
          8741 端口被占用。若已是 rushi-asr 可点「使用当前 8741 服务」，否则结束占用进程后重试。
        </p>
      ) : null}

      {!compact && diskMeta ? <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{diskMeta}</p> : null}

      {!compact && localRuntimeDiag ? (
        <LocalAsrRuntimeInstallPanel
          localRuntimeDiag={localRuntimeDiag}
          wizardBusy={wizardBusy}
          externalSidecarReady={isExternalSidecarSatisfyingSetup(setupReport, {
            selectedModelReady,
          })}
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
    </section>
  );
}
