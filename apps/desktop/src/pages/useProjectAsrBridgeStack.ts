import { useCallback, useRef } from "react";
import { useAsrBridgeController } from "./useAsrBridgeController";
import { useAsrSetupController } from "./useAsrSetupController";
import { getEnvironmentCapabilityBlockReason } from "../services/environmentCapabilityCoordinator";
import { isLocalRuntimeInstallRunning } from "../services/localRuntime/localRuntimeContract";
import { computeLocalAsrTranscribeReady } from "../services/asr/localAsrModelCatalog";
import type { StepsFromReportOptions } from "./asrSetupState";

/** ASR bridge + setup + local transcribe preflight (extracted from useProjectController). */
export function useProjectAsrBridgeStack() {
  const refreshSetupDiagnoseRef = useRef<
    ((options?: { resetSteps?: boolean; touchUi?: boolean }) => Promise<unknown>) | null
  >(null);
  const prepareOverlayRef = useRef<StepsFromReportOptions | null>(null);

  const asr = useAsrBridgeController({
    refreshSetupDiagnoseRef,
  });
  const { refreshAsrHealth, refreshAsrModelCacheInfo, refreshAsrRuntimeInfo } = asr;

  const asrSetup = useAsrSetupController({
    refreshAsrHealth: asr.refreshAsrHealth,
    refreshAsrRuntimeInfo,
    prepareDefaultFunasrModel: asr.prepareDefaultFunasrModel,
    getSetupSelection: () => ({
      selectedHubModelId: asr.localAsrModelCatalog.selectedHubModelId,
      catalogStatus: asr.localAsrModelCatalog.catalogStatus,
      recognitionLanguage: asr.localAsrModelCatalog.recognitionLanguage,
      sidecarAsyncTranscribeCapable: asr.localAsrModelCatalog.sidecarAsyncTranscribeCapable,
    }),
    prepareOverlayRef,
  });
  refreshSetupDiagnoseRef.current = asrSetup.refreshSetupDiagnose;

  const { ready: selectedModelReady } = computeLocalAsrTranscribeReady({
    asrHealth: asr.asrHealth,
    asrCaps: asr.asrCaps,
    selectedHubModelId: asr.localAsrModelCatalog.selectedHubModelId,
    catalogStatus: asr.localAsrModelCatalog.catalogStatus,
  });

  prepareOverlayRef.current = {
    prepareModelBusy: asr.prepareModelBusy,
    prepareModelCancelling: asr.prepareModelCancelling,
    prepareModelProgress: asr.prepareModelProgress,
    selectedModelReady,
  };

  const runtimeInstallRunning = isLocalRuntimeInstallRunning(
    asrSetup.localRuntimeDiag?.install.phase,
  );

  const localTranscribePreflight = useCallback(() => {
    if (runtimeInstallRunning) {
      return "本机 ASR 运行时安装中，暂不可转写。";
    }
    return asr.asrPresentation.blockReason ?? getEnvironmentCapabilityBlockReason();
  }, [asr.asrPresentation, runtimeInstallRunning]);

  return {
    asr,
    asrSetup,
    runtimeInstallRunning,
    refreshAsrHealth,
    refreshAsrModelCacheInfo,
    refreshAsrRuntimeInfo,
    refreshSetupDiagnoseRef,
    localTranscribePreflight,
  };
}

/** Flat ASR fields for ProjectControllerApi (keeps external shape stable). */
export function projectAsrControllerFields(
  asr: ReturnType<typeof useAsrBridgeController>,
  asrSetup: ReturnType<typeof useAsrSetupController>,
) {
  return {
    asrHealth: asr.asrHealth,
    asrHealthDetail: asr.asrHealthDetail,
    asrPresentation: asr.asrPresentation,
    bundledAsrDiag: asr.bundledAsrDiag,
    asrCaps: asr.asrCaps,
    asrModelCacheInfo: asr.asrModelCacheInfo,
    waveformPeaksCacheInfo: asr.waveformPeaksCacheInfo,
    asrModelCacheBusy: asr.asrModelCacheBusy,
    asrCacheMessage: asr.asrCacheMessage,
    sttOnlineBridgeReady: asr.sttOnlineBridgeReady,
    funasrInstallMessage: asr.funasrInstallMessage,
    prepareModelBusy: asr.prepareModelBusy,
    prepareModelCancelling: asr.prepareModelCancelling,
    prepareModelProgress: asr.prepareModelProgress,
    prepareModelFailure: asr.prepareModelFailure,
    prepareDefaultFunasrModel: asr.prepareDefaultFunasrModel,
    cancelPrepareModel: asr.cancelPrepareModel,
    localAsrModelCatalog: asr.localAsrModelCatalog,
    refreshAsrModelCacheInfo: asr.refreshAsrModelCacheInfo,
    clearAsrModelCache: asr.clearAsrModelCache,
    clearOrphanWaveformPeaksCache: asr.clearOrphanWaveformPeaksCache,
    retryBundledAsrSidecar: asr.retryBundledAsrSidecar,
    refreshAsrHealth: asr.refreshAsrHealth,
    installFunasrDepsInteractive: asr.installFunasrDepsInteractive,
    copyFunasrManualCommands: asr.copyFunasrManualCommands,
    bumpSttOnlineRuntimeChanged: asr.bumpSttOnlineRuntimeChanged,
    sttOnlineRuntimeEpoch: asr.sttOnlineRuntimeEpoch,
    asrSetup,
  };
}
