import type { PrepareModelFailureCopy } from "../pages/prepareModelDownloadCopy";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import type { AsrHealthCapabilities, AsrModelCacheInfo, BundledAsrLaunchReport, WaveformPeaksCacheInfo } from "../tauri/projectApi";
import type { PrepareDefaultModelOptions } from "../pages/usePrepareModelController";
import type { AsrSetupControllerApi } from "../pages/useAsrSetupController";
import type { LocalAsrModelCatalogApi } from "../pages/useLocalAsrModelCatalog";
import {
  buildLocalAsrCatalogView,
  selectedModelPrepareState,
} from "../services/asr/localAsrModelCatalog";
import { EnvLocalAsrModelCard } from "./envLocalAsr/EnvLocalAsrModelCard";
import { EnvLocalAsrStatusSection } from "./envLocalAsr/EnvLocalAsrStatusSection";
import { EnvLocalAsrUtilitiesSection } from "./envLocalAsr/EnvLocalAsrUtilitiesSection";
import { LocalAsrSetupWizard } from "./envLocalAsr/LocalAsrSetupWizard";

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

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-7">
      <EnvLocalAsrStatusSection
        presentation={asrPresentation}
        prepareModelBusy={prepareModelBusy}
        busy={busy}
        refreshAsrHealth={refreshAsrHealth}
      />

      {asrPresentation.health === "error" ? (
        <section id="env-asr-setup" className="flex flex-col gap-3">
          <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>安装向导</h3>
          <LocalAsrSetupWizard
            setup={asrSetup}
            busy={busy}
            prepareModelBusy={prepareModelBusy}
            openAppDataFolder={openAppDataFolder}
            exportDiagnosticBundle={exportDiagnosticBundle}
            compact
          />
        </section>
      ) : null}

      <section id="env-asr-models" className="flex flex-col gap-4">
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>转写模型</h3>
        <EnvLocalAsrModelCard
          localAsrModelCatalog={localAsrModelCatalog}
          asrCaps={asrCaps}
          selectedPrepare={selectedPrepare}
          progress={progress}
          prepareModelBusy={prepareModelBusy}
          prepareModelFailure={prepareModelFailure}
          busy={busy}
          modelsCached={modelsCached}
          prepareDefaultFunasrModel={prepareDefaultFunasrModel}
          cancelPrepareModel={cancelPrepareModel}
        />
      </section>

      {asrPresentation.ffmpegWarning ? (
        <p className={`border-t border-notion-divider/60 pt-4 ${PANEL_TYPOGRAPHY.body}`}>
          {asrPresentation.ffmpegWarning}
        </p>
      ) : null}

      <section id="env-asr-utilities" className="flex flex-col gap-3">
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>环境与维护</h3>
        <EnvLocalAsrUtilitiesSection
          presentation={asrPresentation}
          bundledAsrDiag={bundledAsrDiag}
          asrCaps={asrCaps}
          asrModelCacheInfo={asrModelCacheInfo}
          waveformPeaksCacheInfo={waveformPeaksCacheInfo}
          asrModelCacheBusy={asrModelCacheBusy}
          asrCacheMessage={asrCacheMessage}
          funasrInstallMessage={funasrInstallMessage}
          prepareModelBusy={prepareModelBusy}
          busy={busy}
          refreshAsrHealth={refreshAsrHealth}
          installFunasrDepsInteractive={installFunasrDepsInteractive}
          copyFunasrManualCommands={copyFunasrManualCommands}
          refreshAsrModelCacheInfo={refreshAsrModelCacheInfo}
          clearAsrModelCache={clearAsrModelCache}
          clearOrphanWaveformPeaksCache={clearOrphanWaveformPeaksCache}
          retryBundledAsrSidecar={retryBundledAsrSidecar}
          openAppDataFolder={openAppDataFolder}
          exportDiagnosticBundle={exportDiagnosticBundle}
          asrSetup={asrSetup}
        />
      </section>
    </div>
  );
}
