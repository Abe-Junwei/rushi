import { CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { buildRuntimeInstallPresentation } from "../../services/asr/localAsrSetupWizardPresentation";
import type { LocalRuntimeDiagnose } from "../../services/localRuntime/localRuntimeContract";
import {
  EnvCollapsibleMetaSummary,
  EnvCollapsibleSectionSummary,
  ENV_COLLAPSIBLE_DETAILS,
  EnvLocalAsrSmallButton,
} from "./envLocalAsrPanelUi";

type Props = {
  localRuntimeDiag: LocalRuntimeDiagnose;
  wizardBusy: boolean;
  downloadLocalRuntime: () => Promise<void>;
  cancelLocalRuntime: () => Promise<void>;
  refreshLocalRuntimeDiagnose: () => Promise<LocalRuntimeDiagnose | null>;
  revalidateLocalRuntime: () => Promise<void>;
  clearLocalRuntime: () => Promise<void>;
  restorePreviousLocalRuntime: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
};

/** 侧车组件：默认折叠；异常或安装中时自动展开。主操作 +「维护与诊断」二级折叠。 */
export function LocalAsrRuntimeInstallPanel({
  localRuntimeDiag,
  wizardBusy,
  downloadLocalRuntime,
  cancelLocalRuntime,
  refreshLocalRuntimeDiagnose,
  revalidateLocalRuntime,
  clearLocalRuntime,
  restorePreviousLocalRuntime,
  openAppDataFolder,
  exportDiagnosticBundle,
}: Props) {
  const view = buildRuntimeInstallPresentation(localRuntimeDiag);

  return (
    <details
      open={view.needsAttention}
      className={`${ENV_COLLAPSIBLE_DETAILS} border-t border-notion-divider/60 pt-2`}
    >
      <EnvCollapsibleSectionSummary title="侧车组件" trailing={view.shortStatus} />

      <div className="mt-2 flex flex-col gap-2 pb-1">
        <p className={PANEL_TYPOGRAPHY.meta}>{view.statusLine}</p>
        {view.supplementalLines.map((line) => (
          <p key={line} className={PANEL_TYPOGRAPHY.meta}>
            {line}
          </p>
        ))}
        {view.alertLine ? (
          <p className={`${PANEL_TYPOGRAPHY.meta} text-zen-cinnabar`}>{view.alertLine}</p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={wizardBusy || view.runtimeInstallRunning || view.manifestInstallBlocked}
            onClick={() => void downloadLocalRuntime()}
          >
            下载 / 修复
          </button>
          {view.runtimeInstallRunning ? (
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              disabled={wizardBusy}
              onClick={() => void cancelLocalRuntime()}
            >
              取消
            </button>
          ) : null}
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={wizardBusy}
            onClick={() => void refreshLocalRuntimeDiagnose()}
          >
            刷新
          </button>
        </div>

        <details className={`${ENV_COLLAPSIBLE_DETAILS} pt-1`}>
          <EnvCollapsibleMetaSummary>维护与诊断</EnvCollapsibleMetaSummary>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <EnvLocalAsrSmallButton
                disabled={
                  wizardBusy ||
                  view.runtimeInstallRunning ||
                  !localRuntimeDiag.installed.executablePath
                }
                onClick={() => void revalidateLocalRuntime()}
              >
                重新验证
              </EnvLocalAsrSmallButton>
              <EnvLocalAsrSmallButton
                disabled={
                  wizardBusy ||
                  view.runtimeInstallRunning ||
                  localRuntimeDiag.installed.status === "missing"
                }
                onClick={() => void clearLocalRuntime()}
              >
                清除组件
              </EnvLocalAsrSmallButton>
              <EnvLocalAsrSmallButton
                disabled={
                  wizardBusy ||
                  view.runtimeInstallRunning ||
                  !localRuntimeDiag.installed.previousVersion
                }
                onClick={() => void restorePreviousLocalRuntime()}
              >
                恢复上一版本
              </EnvLocalAsrSmallButton>
            </div>
            <div className="flex flex-wrap gap-2">
              <EnvLocalAsrSmallButton disabled={wizardBusy} onClick={() => void openAppDataFolder()}>
                打开数据目录
              </EnvLocalAsrSmallButton>
              <EnvLocalAsrSmallButton disabled={wizardBusy} onClick={() => void exportDiagnosticBundle()}>
                导出诊断包
              </EnvLocalAsrSmallButton>
            </div>
          </div>
        </details>
      </div>
    </details>
  );
}
