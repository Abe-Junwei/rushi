import { asrBaseUrl, isDefaultBundledAsrTarget, isTauriRuntime } from "../config/env";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { PrepareModelFailureCopy } from "../pages/prepareModelDownloadCopy";
import type { AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import type { AsrHealthCapabilities, AsrModelCacheInfo, BundledAsrLaunchReport, WaveformPeaksCacheInfo } from "../tauri/projectApi";
import type { PrepareDefaultModelOptions } from "../pages/usePrepareModelController";
import type { AsrSetupControllerApi } from "../pages/useAsrSetupController";
import type { LocalAsrModelCatalogApi } from "../pages/useLocalAsrModelCatalog";
import { LocalAsrModelSection } from "./envLocalAsr/LocalAsrModelSection";
import {
  buildLocalAsrCatalogView,
  selectedModelPrepareState,
} from "../services/asr/localAsrModelCatalog";
import { LocalAsrAdvancedSection } from "./envLocalAsr/LocalAsrAdvancedSection";
import { LocalAsrCacheSection } from "./envLocalAsr/LocalAsrCacheSection";
import { LocalAsrSetupWizard } from "./envLocalAsr/LocalAsrSetupWizard";
import { EnvLocalAsrStatusSection } from "./envLocalAsr/EnvLocalAsrStatusSection";
import { EnvLocalAsrModelDownloadSection } from "./envLocalAsr/EnvLocalAsrModelDownloadSection";
import { EnvLocalAsrSmallButton } from "./envLocalAsr/envLocalAsrPanelUi";

type Props = {
  asrPresentation: AsrEnvPresentation;
  bundledAsrDiag: BundledAsrLaunchReport | null;
  asrCaps: AsrHealthCapabilities | null;
  asrModelCacheInfo: AsrModelCacheInfo | null;
  waveformPeaksCacheInfo: WaveformPeaksCacheInfo | null;
  asrModelCacheBusy: boolean;
  asrCacheMessage: string;
  funasrInstallMessage: string;
  prepareModelBusy: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelFailureCopy | null;
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
  installFunasrDepsInteractive: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
  prepareDefaultFunasrModel: (options?: PrepareDefaultModelOptions) => Promise<void>;
  cancelPrepareModel: () => void;
  refreshAsrModelCacheInfo: () => Promise<void>;
  clearAsrModelCache: () => Promise<void>;
  clearOrphanWaveformPeaksCache: () => Promise<void>;
  retryBundledAsrSidecar: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  exportDiagnosticBundle: () => Promise<void>;
  asrSetup: AsrSetupControllerApi;
  localAsrModelCatalog: LocalAsrModelCatalogApi;
};

export function EnvLocalAsrPanel({
  asrPresentation,
  bundledAsrDiag,
  asrCaps,
  asrModelCacheInfo,
  waveformPeaksCacheInfo,
  asrModelCacheBusy,
  asrCacheMessage,
  funasrInstallMessage,
  prepareModelBusy,
  prepareModelProgress,
  prepareModelFailure,
  busy,
  refreshAsrHealth,
  installFunasrDepsInteractive,
  copyFunasrManualCommands,
  prepareDefaultFunasrModel,
  cancelPrepareModel,
  refreshAsrModelCacheInfo,
  clearAsrModelCache,
  clearOrphanWaveformPeaksCache,
  retryBundledAsrSidecar,
  openAppDataFolder,
  exportDiagnosticBundle,
  asrSetup,
  localAsrModelCatalog,
}: Props) {
  const catalogView = buildLocalAsrCatalogView(
    asrCaps,
    localAsrModelCatalog.catalogStatus,
    localAsrModelCatalog.selectedHubModelId,
  );
  const selectedPrepare = selectedModelPrepareState(
    catalogView,
    localAsrModelCatalog.selectedHubModelId,
    asrCaps?.funasr_model_id,
  );
  const modelsCached = selectedPrepare.cached;
  const progress = prepareModelBusy ? prepareModelProgress : modelsCached ? 100 : 0;
  const sidecarModelsRoot = asrCaps?.rushi_models_root ?? null;
  const desktopModelsRoot = asrModelCacheInfo?.models_root ?? null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-8">
      <EnvLocalAsrStatusSection
        presentation={asrPresentation}
        busy={busy}
        refreshAsrHealth={refreshAsrHealth}
      />

      <div className="h-px bg-notion-divider" />

      <LocalAsrSetupWizard
        setup={asrSetup}
        busy={busy}
        prepareModelBusy={prepareModelBusy}
        openAppDataFolder={openAppDataFolder}
        exportDiagnosticBundle={exportDiagnosticBundle}
      />

      <LocalAsrAdvancedSection
        asrHealth={asrPresentation.health}
        asrCaps={asrCaps}
        funasrInstallMessage={funasrInstallMessage}
        busy={busy}
        installFunasrDepsInteractive={installFunasrDepsInteractive}
        copyFunasrManualCommands={copyFunasrManualCommands}
      />

      {asrPresentation.ffmpegWarning ? (
        <div className="rounded border border-notion-divider bg-notion-callout-bg px-3 py-2 text-sm text-notion-text-muted">
          {asrPresentation.ffmpegWarning}
        </div>
      ) : null}

      {asrPresentation.health === "ok" && asrCaps ? (
        <p className={PANEL_TYPOGRAPHY.meta}>
          侧车模型目录{" "}
          <code className="font-mono text-[11px] text-zen-indigo">
            {sidecarModelsRoot ?? "（未绑定，侧车看不到桌面缓存）"}
          </code>
          {desktopModelsRoot ? (
            <>
              {" "}
              · 桌面缓存{" "}
              <code className="font-mono text-[11px] text-zen-indigo">{desktopModelsRoot}</code>
            </>
          ) : null}
        </p>
      ) : null}

      {asrPresentation.cachePathMismatch || asrPresentation.modelsOnDiskButSidecarBlind ? (
        <div
          className="rounded border border-zen-saffron/30 bg-zen-saffron/10 px-3 py-2 text-sm text-notion-text"
          role="status"
        >
          <p className="font-medium">
            {asrPresentation.cachePathMismatchDetail ?? asrPresentation.modelsOnDiskButSidecarBlindDetail}
          </p>
        </div>
      ) : null}

      {asrPresentation.connectedGuidance ? (
        <div className="rounded border border-notion-divider bg-notion-callout-bg px-3 py-2 text-sm text-notion-text">
          <strong>已连接侧车</strong>
          <span className="text-notion-text-muted"> — {asrPresentation.connectedGuidance}</span>
        </div>
      ) : null}

      {asrPresentation.health === "error" ? (
        <div className="space-y-2 rounded bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar">
          <p>{asrPresentation.errorDetail ?? asrPresentation.bannerDetail}</p>
          <div className="flex flex-wrap gap-2">
            {isDefaultBundledAsrTarget() && bundledAsrDiag?.attempted ? (
              <EnvLocalAsrSmallButton disabled={busy} onClick={() => void retryBundledAsrSidecar()}>
                重试内置侧车
              </EnvLocalAsrSmallButton>
            ) : null}
            <EnvLocalAsrSmallButton disabled={busy} onClick={() => void openAppDataFolder()}>
              打开应用数据目录
            </EnvLocalAsrSmallButton>
          </div>
          <p className={PANEL_TYPOGRAPHY.meta}>
            基址 <code className="font-mono text-zen-indigo">{asrBaseUrl()}</code> · <code className="font-mono">VITE_ASR_BASE_URL</code>
          </p>
        </div>
      ) : null}

      <div className="h-px bg-notion-divider" />

      <LocalAsrModelSection
        catalog={localAsrModelCatalog}
        asrCaps={asrCaps}
        busy={busy}
        prepareModelBusy={prepareModelBusy}
      />

      <div className="h-px bg-notion-divider" />

      <EnvLocalAsrModelDownloadSection
        localAsrModelCatalog={localAsrModelCatalog}
        selectedPrepare={selectedPrepare}
        progress={progress}
        prepareModelBusy={prepareModelBusy}
        prepareModelFailure={prepareModelFailure}
        funasrInstallMessage={funasrInstallMessage}
        busy={busy}
        modelsCached={modelsCached}
        prepareDefaultFunasrModel={prepareDefaultFunasrModel}
        cancelPrepareModel={cancelPrepareModel}
        refreshAsrHealth={refreshAsrHealth}
      />

      <div className="h-px bg-notion-divider" />

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
      />
    </div>
  );
}
