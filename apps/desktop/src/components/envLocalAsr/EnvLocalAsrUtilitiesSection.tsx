import { asrBaseUrl, isDefaultBundledAsrTarget, isTauriRuntime } from "../../config/env";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { AsrEnvPresentation } from "../../services/asr/asrEnvStatus";
import type {
  AsrHealthCapabilities,
  AsrModelCacheInfo,
  BundledAsrLaunchReport,
  WaveformPeaksCacheInfo,
} from "../../tauri/projectApi";
import type { AsrSetupControllerApi } from "../../pages/useAsrSetupController";
import {
  EnvLocalAsrCollapsibleSection,
  EnvLocalAsrSmallButton,
  EnvUtilitiesActionRow,
  EnvUtilitiesMetaGroup,
  EnvUtilitiesSubsection,
} from "./envLocalAsrPanelUi";
import { LocalAsrAdvancedSection } from "./LocalAsrAdvancedSection";
import { LocalAsrCacheSection } from "./LocalAsrCacheSection";
import { LocalAsrSetupWizard } from "./LocalAsrSetupWizard";

type Props = {
  presentation: AsrEnvPresentation;
  bundledAsrDiag: BundledAsrLaunchReport | null;
  asrCaps: AsrHealthCapabilities | null;
  asrModelCacheInfo: AsrModelCacheInfo | null;
  waveformPeaksCacheInfo: WaveformPeaksCacheInfo | null;
  asrModelCacheBusy: boolean;
  asrCacheMessage: string;
  funasrInstallMessage: string;
  prepareModelBusy: boolean;
  prepareModelCancelling?: boolean;
  transcribeBlockReason?: string | null;
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
  refreshAsrModelCacheInfo: () => Promise<void>;
  clearAsrModelCache: () => Promise<void>;
  clearOrphanWaveformPeaksCache: () => Promise<void>;
  retryBundledAsrSidecar: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
  asrSetup: AsrSetupControllerApi;
  /** 主路径已展示安装向导时，折叠区不再重复。 */
  hideSetupWizard?: boolean;
  selectedModelReady?: boolean;
};

/** 安装向导 / 高级诊断 / 缓存 — 三块独立折叠，默认收起。 */
export function EnvLocalAsrUtilitiesSection({
  presentation,
  bundledAsrDiag,
  asrCaps,
  asrModelCacheInfo,
  waveformPeaksCacheInfo,
  asrModelCacheBusy,
  asrCacheMessage,
  funasrInstallMessage,
  prepareModelBusy,
  prepareModelCancelling = false,
  transcribeBlockReason = null,
  busy,
  copyFunasrManualCommands,
  refreshAsrModelCacheInfo,
  clearAsrModelCache,
  clearOrphanWaveformPeaksCache,
  retryBundledAsrSidecar,
  openAppDataFolder,
  exportDiagnosticBundle,
  asrSetup,
  hideSetupWizard = false,
  selectedModelReady = false,
}: Props) {
  const sidecarModelsRoot = asrCaps?.rushi_models_root ?? null;
  const desktopModelsRoot = asrModelCacheInfo?.models_root ?? null;

  return (
    <div className="flex flex-col">
      {presentation.health !== "error" && !hideSetupWizard ? (
        <EnvLocalAsrCollapsibleSection id="env-asr-setup-wizard" title="安装向导">
          <LocalAsrSetupWizard
            setup={asrSetup}
            busy={busy}
            prepareModelBusy={prepareModelBusy}
            prepareModelCancelling={prepareModelCancelling}
            selectedModelReady={selectedModelReady}
            transcribeBlockReason={transcribeBlockReason}
            openAppDataFolder={openAppDataFolder}
            exportDiagnosticBundle={exportDiagnosticBundle}
            embedded
          />
        </EnvLocalAsrCollapsibleSection>
      ) : null}

      <EnvLocalAsrCollapsibleSection id="env-asr-advanced-diagnostics" title="高级诊断">
        {presentation.health === "error" ? (
          <EnvUtilitiesSubsection
            title="连接状态"
            description={
              <p className="m-0">
                基址 <code className="font-mono text-notion-text-muted">{asrBaseUrl()}</code>
              </p>
            }
          >
            {isDefaultBundledAsrTarget() &&
            bundledAsrDiag &&
            !bundledAsrDiag.success &&
            (bundledAsrDiag.attempted || Boolean(bundledAsrDiag.detail)) ? (
              <EnvUtilitiesActionRow>
                <EnvLocalAsrSmallButton
                  disabled={busy || prepareModelBusy || prepareModelCancelling}
                  onClick={() => void retryBundledAsrSidecar()}
                >
                  重试内置侧车
                </EnvLocalAsrSmallButton>
              </EnvUtilitiesActionRow>
            ) : null}
          </EnvUtilitiesSubsection>
        ) : null}

        {presentation.cachePathMismatch || presentation.modelsOnDiskButSidecarBlind ? (
          <EnvUtilitiesSubsection title="路径告警">
            <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-accent-action`} role="status">
              {presentation.cachePathMismatchDetail ?? presentation.modelsOnDiskButSidecarBlindDetail}
            </p>
          </EnvUtilitiesSubsection>
        ) : null}

        {presentation.health === "ok" && asrCaps ? (
          <EnvUtilitiesSubsection title="模型目录">
            <EnvUtilitiesMetaGroup>
              <p className="m-0">
                侧车{" "}
                <code className="font-mono text-notion-text-muted">{sidecarModelsRoot ?? "（未绑定）"}</code>
              </p>
              {desktopModelsRoot ? (
                <p className="m-0">
                  桌面缓存 <code className="font-mono text-notion-text-muted">{desktopModelsRoot}</code>
                </p>
              ) : null}
            </EnvUtilitiesMetaGroup>
          </EnvUtilitiesSubsection>
        ) : null}

        <LocalAsrAdvancedSection
          asrHealth={presentation.health}
          asrCaps={asrCaps}
          funasrInstallMessage={funasrInstallMessage}
          busy={busy}
          copyFunasrManualCommands={copyFunasrManualCommands}
          embedded
        />
      </EnvLocalAsrCollapsibleSection>

      <EnvLocalAsrCollapsibleSection title="缓存管理">
        <LocalAsrCacheSection
          asrModelCacheInfo={asrModelCacheInfo}
          waveformPeaksCacheInfo={waveformPeaksCacheInfo}
          asrModelCacheBusy={asrModelCacheBusy}
          asrCacheMessage={asrCacheMessage}
          busy={busy}
          prepareModelBusy={prepareModelBusy}
          prepareModelCancelling={prepareModelCancelling}
          tauriRuntime={isTauriRuntime()}
          refreshAsrModelCacheInfo={refreshAsrModelCacheInfo}
          clearAsrModelCache={clearAsrModelCache}
          clearOrphanWaveformPeaksCache={clearOrphanWaveformPeaksCache}
          openAppDataFolder={openAppDataFolder}
          embedded
        />
      </EnvLocalAsrCollapsibleSection>
    </div>
  );
}
