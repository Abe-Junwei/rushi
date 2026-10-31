import { useCallback, useRef } from "react";
import { useAsrBridgeController } from "./useAsrBridgeController";
import { useAsrSetupController } from "./useAsrSetupController";
import {
  getEnvironmentCapabilityBlockReason,
  hasEnvironmentCapabilitySnapshot,
} from "../services/environmentCapabilityCoordinator";
import { isLocalRuntimeInstallRunning } from "../services/localRuntime/localRuntimeContract";
import { computeLocalAsrTranscribeReady } from "../services/asr/localAsrModelCatalog";
import { softWakeIdleSidecar } from "../services/asr/localAsrSidecarSoftWake";
import { toast } from "../services/ui/toast";
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
    bundledCopyPresentationSync: asr.bundledCopyPresentationSync,
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

  const softWakeBeforeLocalTranscribe = useCallback(async () => {
    if (runtimeInstallRunning) return;
    // Always consult supervisor inside softWake (no-op if not idle); do not gate on
    // React presentation — it can lag behind try_start / health refresh.
    const wake = await softWakeIdleSidecar();
    if (wake.status === "failed") {
      toast.warning(`恢复侧车失败：${wake.message}`);
    } else if (wake.status === "woke" && !wake.healthOk) {
      toast.warning("侧车已拉起，但仍未通过健康检查。");
    }
    await refreshAsrRuntimeInfo();
  }, [refreshAsrRuntimeInfo, runtimeInstallRunning]);

  const localTranscribePreflight = useCallback(() => {
    if (runtimeInstallRunning) {
      return "本机 ASR 运行时安装中，暂不可转写。";
    }
    // Snapshot null blockReason means ready — do not fall back to stale React presentation.
    if (hasEnvironmentCapabilitySnapshot()) {
      return getEnvironmentCapabilityBlockReason();
    }
    return asr.asrPresentation.blockReason;
  }, [asr.asrPresentation.blockReason, runtimeInstallRunning]);

  return {
    asr,
    asrSetup,
    runtimeInstallRunning,
    refreshAsrHealth,
    refreshAsrModelCacheInfo,
    refreshAsrRuntimeInfo,
    refreshSetupDiagnoseRef,
    softWakeBeforeLocalTranscribe,
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
    localAsrModelCatalog: asr.localAsrModelCatalog,
    refreshAsrModelCacheInfo: asr.refreshAsrModelCacheInfo,
    clearAsrModelCache: asr.clearAsrModelCache,
    clearOrphanWaveformPeaksCache: asr.clearOrphanWaveformPeaksCache,
    retryBundledAsrSidecar: asr.retryBundledAsrSidecar,
    recoverIdleAsrSidecar: asr.recoverIdleAsrSidecar,
    asrSupervisor: asr.asrSupervisor,
    refreshAsrHealth: asr.refreshAsrHealth,
    installFunasrDepsInteractive: asr.installFunasrDepsInteractive,
    copyFunasrManualCommands: asr.copyFunasrManualCommands,
    bumpSttOnlineRuntimeChanged: asr.bumpSttOnlineRuntimeChanged,
    sttOnlineRuntimeEpoch: asr.sttOnlineRuntimeEpoch,
    asrSetup,
  };
}
