import { CONTROL_BTN_LINK, CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import {
  buildRuntimeInstallPresentation,
  buildRuntimeMaintenanceActions,
} from "../../services/asr/localAsrSetupWizardPresentation";
import type { LocalRuntimeDiagnose } from "../../services/localRuntime/localRuntimeContract";
import { openEnvManualSetupGuide } from "./asrStatusRowActions";
import {
  PANEL_PROGRESS_FILL_COMPACT_CLASS,
  PANEL_PROGRESS_TRACK_COMPACT_CLASS,
} from "../panelProgressStyles";
import {
  EnvCollapsibleSectionSummary,
  ENV_COLLAPSIBLE_DETAILS,
  ENV_UTILITIES_NESTED_BODY,
  EnvLocalAsrSmallButton,
  EnvUtilitiesActionRow,
  EnvUtilitiesMetaGroup,
  EnvUtilitiesSubsection,
} from "./envLocalAsrPanelUi";

type Props = {
  localRuntimeDiag: LocalRuntimeDiagnose;
  wizardBusy: boolean;
  externalSidecarReady?: boolean;
  downloadLocalRuntime: () => Promise<void>;
  cancelLocalRuntime: () => Promise<void>;
  refreshLocalRuntimeDiagnose: () => Promise<LocalRuntimeDiagnose | null>;
  revalidateLocalRuntime: () => Promise<void>;
  clearLocalRuntime: () => Promise<void>;
  restorePreviousLocalRuntime: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
};

/** 侧车组件：默认折叠；异常或安装中时自动展开。 */
export function LocalAsrRuntimeInstallPanel({
  localRuntimeDiag,
  wizardBusy,
  externalSidecarReady = false,
  downloadLocalRuntime,
  cancelLocalRuntime,
  refreshLocalRuntimeDiagnose,
  revalidateLocalRuntime,
  clearLocalRuntime,
  restorePreviousLocalRuntime,
  openAppDataFolder,
  exportDiagnosticBundle,
}: Props) {
  const view = buildRuntimeInstallPresentation(localRuntimeDiag, { externalSidecarReady });
  const maintenance = buildRuntimeMaintenanceActions(localRuntimeDiag, {
    wizardBusy,
    runtimeInstallRunning: view.runtimeInstallRunning,
  });

  return (
    <details open={view.needsAttention} className={ENV_COLLAPSIBLE_DETAILS}>
      <EnvCollapsibleSectionSummary title="侧车组件" trailing={view.shortStatus} />

      <div className={ENV_UTILITIES_NESTED_BODY}>
        <EnvUtilitiesMetaGroup>
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{view.statusLine}</p>
          {view.supplementalLines.map((line) => (
            <p key={line} className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
              {line}
            </p>
          ))}
          {view.alertLine ? (
            <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-zen-cinnabar`}>{view.alertLine}</p>
          ) : null}
        </EnvUtilitiesMetaGroup>

        {view.showDownloadProgress ? (
          <div>
            <div className="mb-2 flex items-end justify-between gap-2">
              <span className={PANEL_TYPOGRAPHY.meta}>下载进度</span>
              <span className="font-mono text-body text-notion-text-muted">
                {view.downloadProgressLabel}
              </span>
            </div>
            <div
              className={PANEL_PROGRESS_TRACK_COMPACT_CLASS}
              role="progressbar"
              aria-valuenow={view.downloadProgressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="侧车组件下载进度"
            >
              <div
                className={PANEL_PROGRESS_FILL_COMPACT_CLASS}
                style={{ width: `${view.downloadProgressPercent}%` }}
              />
            </div>
          </div>
        ) : null}

        <EnvUtilitiesSubsection title="侧车操作">
          <EnvUtilitiesActionRow>
            {view.showDownloadAction ? (
              <button
                type="button"
                className={CONTROL_BTN_SECONDARY}
                disabled={wizardBusy || view.runtimeInstallRunning}
                onClick={() => void downloadLocalRuntime()}
              >
                下载 / 修复
              </button>
            ) : (
              <button
                type="button"
                className={`${CONTROL_BTN_LINK} ${PANEL_TYPOGRAPHY.button} text-zen-saffron-mid hover:text-zen-saffron`}
                disabled={wizardBusy}
                onClick={openEnvManualSetupGuide}
              >
                查看手动安装说明
              </button>
            )}
            {view.runtimeInstallRunning ? (
              <button
                type="button"
                className={CONTROL_BTN_SECONDARY}
                disabled={wizardBusy}
                onClick={() => void cancelLocalRuntime()}
              >
                取消下载
              </button>
            ) : null}
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              disabled={wizardBusy}
              onClick={() => void refreshLocalRuntimeDiagnose()}
            >
              刷新状态
            </button>
          </EnvUtilitiesActionRow>
        </EnvUtilitiesSubsection>

        {maintenance.showComponentMaintenance ? (
          <EnvUtilitiesSubsection title="组件维护">
            <EnvUtilitiesActionRow>
              {maintenance.canRevalidate ? (
                <EnvLocalAsrSmallButton disabled={wizardBusy} onClick={() => void revalidateLocalRuntime()}>
                  重新验证
                </EnvLocalAsrSmallButton>
              ) : null}
              {maintenance.canClear ? (
                <EnvLocalAsrSmallButton disabled={wizardBusy} onClick={() => void clearLocalRuntime()}>
                  清除组件
                </EnvLocalAsrSmallButton>
              ) : null}
              {maintenance.canRestorePrevious ? (
                <EnvLocalAsrSmallButton
                  disabled={wizardBusy}
                  onClick={() => void restorePreviousLocalRuntime()}
                >
                  恢复上一版本
                </EnvLocalAsrSmallButton>
              ) : null}
            </EnvUtilitiesActionRow>
          </EnvUtilitiesSubsection>
        ) : null}

        <EnvUtilitiesSubsection title="诊断工具">
          <EnvUtilitiesActionRow>
            <EnvLocalAsrSmallButton disabled={wizardBusy} onClick={() => void openAppDataFolder()}>
              打开数据目录
            </EnvLocalAsrSmallButton>
            <EnvLocalAsrSmallButton disabled={wizardBusy} onClick={() => void exportDiagnosticBundle()}>
              导出诊断包
            </EnvLocalAsrSmallButton>
          </EnvUtilitiesActionRow>
        </EnvUtilitiesSubsection>
      </div>
    </details>
  );
}
