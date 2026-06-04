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
import { EnvLocalAsrCollapsibleSection, EnvLocalAsrSmallButton } from "./envLocalAsrPanelUi";
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
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
  installFunasrDepsInteractive: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
  refreshAsrModelCacheInfo: () => Promise<void>;
  clearAsrModelCache: () => Promise<void>;
  clearOrphanWaveformPeaksCache: () => Promise<void>;
  retryBundledAsrSidecar: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
  asrSetup: AsrSetupControllerApi;
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
  busy,
  installFunasrDepsInteractive,
  copyFunasrManualCommands,
  refreshAsrModelCacheInfo,
  clearAsrModelCache,
  clearOrphanWaveformPeaksCache,
  retryBundledAsrSidecar,
  openAppDataFolder,
  exportDiagnosticBundle,
  asrSetup,
}: Props) {
  const sidecarModelsRoot = asrCaps?.rushi_models_root ?? null;
  const desktopModelsRoot = asrModelCacheInfo?.models_root ?? null;

  return (
    <div className="flex flex-col gap-2">
      {presentation.health !== "error" ? (
        <EnvLocalAsrCollapsibleSection title="安装向导">
          <LocalAsrSetupWizard
            setup={asrSetup}
            busy={busy}
            prepareModelBusy={prepareModelBusy}
            openAppDataFolder={openAppDataFolder}
            exportDiagnosticBundle={exportDiagnosticBundle}
            embedded
          />
        </EnvLocalAsrCollapsibleSection>
      ) : null}

      <EnvLocalAsrCollapsibleSection title="高级诊断">
        {presentation.health === "error" ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {isDefaultBundledAsrTarget() && bundledAsrDiag?.attempted ? (
                <EnvLocalAsrSmallButton disabled={busy} onClick={() => void retryBundledAsrSidecar()}>
                  重试内置侧车
                </EnvLocalAsrSmallButton>
              ) : null}
            </div>
            <p className={PANEL_TYPOGRAPHY.meta}>
              基址 <code className="font-mono text-zen-indigo">{asrBaseUrl()}</code>
            </p>
          </div>
        ) : null}

        {presentation.cachePathMismatch || presentation.modelsOnDiskButSidecarBlind ? (
          <p className={`${PANEL_TYPOGRAPHY.meta} text-zen-saffron`} role="status">
            {presentation.cachePathMismatchDetail ?? presentation.modelsOnDiskButSidecarBlindDetail}
          </p>
        ) : null}

        {presentation.health === "ok" && asrCaps ? (
          <p className={PANEL_TYPOGRAPHY.meta}>
            侧车模型目录{" "}
            <code className="font-mono text-zen-indigo">{sidecarModelsRoot ?? "（未绑定）"}</code>
            {desktopModelsRoot ? (
              <>
                {" "}
                · 桌面缓存 <code className="font-mono text-zen-indigo">{desktopModelsRoot}</code>
              </>
            ) : null}
          </p>
        ) : null}

        <LocalAsrAdvancedSection
          asrHealth={presentation.health}
          asrCaps={asrCaps}
          funasrInstallMessage={funasrInstallMessage}
          busy={busy}
          installFunasrDepsInteractive={installFunasrDepsInteractive}
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
