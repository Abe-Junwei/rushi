import type { PrepareModelFailureCopy } from "../pages/prepareModelDownloadCopy";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { ENV_PANEL_PAGE_CLASS, ENV_PANEL_SECTION_CLASS, ENV_PANEL_SECTION_TOOLS_CLASS } from "../utils/environmentPanelNav";
import type { AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import { buildAsrCatalogPresentation } from "../services/asr/asrCatalogPresentation";
import type {
  AsrHealthCapabilities,
  AsrModelCacheInfo,
  BundledAsrLaunchReport,
  WaveformPeaksCacheInfo,
} from "../tauri/projectApi";
import type { AsrSetupControllerApi } from "../pages/useAsrSetupController";
import { useAsrCudaSidecarRecommend } from "../pages/useAsrCudaSidecarRecommend";
import type { LocalAsrModelCatalogApi } from "../pages/useLocalAsrModelCatalog";
import { EnvAsrCudaRecommendBanner } from "./envLocalAsr/EnvAsrCudaRecommendBanner";
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
  prepareModelCancelling: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelFailureCopy | null;
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
  recoverIdleAsrSidecar?: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
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
  prepareModelCancelling,
  prepareModelProgress,
  prepareModelFailure,
  busy,
  refreshAsrHealth,
  recoverIdleAsrSidecar,
  copyFunasrManualCommands,
  refreshAsrModelCacheInfo,
  clearAsrModelCache,
  clearOrphanWaveformPeaksCache,
  retryBundledAsrSidecar,
  openAppDataFolder,
  exportDiagnosticBundle,
  asrSetup,
  localAsrModelCatalog,
}: Props) {
  const catalogPresentation = buildAsrCatalogPresentation({
    asrCaps,
    catalogStatus: localAsrModelCatalog.catalogStatus,
    selectedHubModelId: localAsrModelCatalog.selectedHubModelId,
    prepareModelBusy,
    prepareModelCancelling,
    prepareModelProgress,
  });
  const cudaRecommend = useAsrCudaSidecarRecommend();

  const showProminentSetup = !asrPresentation.chipOk;

  return (
    <div className={ENV_PANEL_PAGE_CLASS}>
      <EnvLocalAsrStatusSection
        presentation={asrPresentation}
        busy={busy}
        refreshAsrHealth={refreshAsrHealth}
        recoverSidecar={recoverIdleAsrSidecar}
      />

      <EnvAsrCudaRecommendBanner
        status={cudaRecommend.status}
        busy={cudaRecommend.busy}
        message={cudaRecommend.message}
        onDownload={() => void cudaRecommend.startDownload()}
        onCancel={() => void cudaRecommend.cancelDownload()}
        onRestartSidecar={retryBundledAsrSidecar}
      />

      {showProminentSetup ? (
        <section id="env-asr-setup" className={ENV_PANEL_SECTION_CLASS}>
          <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>
            {asrPresentation.sidecarIdleSleeping
              ? "安装向导"
              : asrPresentation.health === "error"
                ? "安装向导"
                : "一键准备"}
          </h3>
          <LocalAsrSetupWizard
            setup={asrSetup}
            busy={busy}
            prepareModelBusy={prepareModelBusy}
            prepareModelCancelling={prepareModelCancelling}
            selectedModelReady={catalogPresentation.modelsReady}
            transcribeBlockReason={asrPresentation.blockReason}
            openAppDataFolder={openAppDataFolder}
            exportDiagnosticBundle={exportDiagnosticBundle}
            compact={asrPresentation.health === "error"}
            embedded={asrPresentation.health !== "error"}
          />
        </section>
      ) : null}

      <section id="env-asr-models" className={ENV_PANEL_SECTION_TOOLS_CLASS}>
        <h3 className={PANEL_TYPOGRAPHY.envSectionTitle}>转写模型</h3>
        <EnvLocalAsrModelCard
          localAsrModelCatalog={localAsrModelCatalog}
          asrCaps={asrCaps}
          catalogPresentation={catalogPresentation}
          prepareModelBusy={prepareModelBusy}
          prepareModelCancelling={prepareModelCancelling}
          prepareModelFailure={prepareModelFailure}
          funasrInstallMessage={funasrInstallMessage}
          busy={busy}
        />
      </section>

      {asrPresentation.ffmpegWarning ? (
        <p className={`m-0 ${PANEL_TYPOGRAPHY.body}`}>
          {asrPresentation.ffmpegWarning}
        </p>
      ) : null}

      <section id="env-asr-utilities" className={ENV_PANEL_SECTION_CLASS}>
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
          prepareModelCancelling={prepareModelCancelling}
          transcribeBlockReason={asrPresentation.blockReason}
          busy={busy}
          refreshAsrHealth={refreshAsrHealth}
          copyFunasrManualCommands={copyFunasrManualCommands}
          refreshAsrModelCacheInfo={refreshAsrModelCacheInfo}
          clearAsrModelCache={clearAsrModelCache}
          clearOrphanWaveformPeaksCache={clearOrphanWaveformPeaksCache}
          retryBundledAsrSidecar={retryBundledAsrSidecar}
          openAppDataFolder={openAppDataFolder}
          exportDiagnosticBundle={exportDiagnosticBundle}
          asrSetup={asrSetup}
          hideSetupWizard={showProminentSetup}
          selectedModelReady={catalogPresentation.modelsReady}
        />
      </section>
    </div>
  );
}
