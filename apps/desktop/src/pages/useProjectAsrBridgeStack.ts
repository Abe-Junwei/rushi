import { useCallback, useRef } from "react";
import { useAsrBridgeController } from "./useAsrBridgeController";
import { useAsrSetupController } from "./useAsrSetupController";
import { refreshLocalAsrDiagnostics } from "./refreshLocalAsrDiagnostics";
import { getEnvironmentCapabilityBlockReason } from "../services/environmentCapabilityCoordinator";

/** ASR bridge + setup + local transcribe preflight (extracted from useProjectController). */
export function useProjectAsrBridgeStack() {
  const refreshSetupDiagnoseRef = useRef<
    ((options?: { resetSteps?: boolean; touchUi?: boolean }) => Promise<unknown>) | null
  >(null);

  const asr = useAsrBridgeController({
    refreshEnvironmentDiagnostics: async () => {
      const refreshSetup = refreshSetupDiagnoseRef.current;
      if (!refreshSetup) return;
      await refreshSetup({ resetSteps: false, touchUi: false });
    },
  });
  const { refreshAsrHealth, refreshAsrModelCacheInfo } = asr;
  const refreshAsrRuntimeInfo = useCallback(async () => {
    await refreshLocalAsrDiagnostics({
      refreshAsrHealth,
      refreshAsrModelCacheInfo,
      refreshSetupDiagnose: refreshSetupDiagnoseRef.current ?? undefined,
    });
  }, [refreshAsrHealth, refreshAsrModelCacheInfo]);

  const asrSetup = useAsrSetupController({
    refreshAsrHealth: asr.refreshAsrHealth,
    refreshAsrRuntimeInfo,
    prepareDefaultFunasrModel: asr.prepareDefaultFunasrModel,
    getSetupSelection: () => ({
      selectedHubModelId: asr.localAsrModelCatalog.selectedHubModelId,
      catalogStatus: asr.localAsrModelCatalog.catalogStatus,
    }),
  });
  refreshSetupDiagnoseRef.current = asrSetup.refreshSetupDiagnose;

  const localTranscribePreflight = useCallback(
    () => asr.asrPresentation.blockReason ?? getEnvironmentCapabilityBlockReason(),
    [asr.asrPresentation],
  );

  return {
    asr,
    asrSetup,
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
    asrSetup,
  };
}
