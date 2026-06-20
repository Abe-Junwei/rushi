import { useMemo, useRef } from "react";
import { useProjectLifecycleController, type BusyReason } from "./useProjectLifecycleController";
import { useEnvironmentCapabilitySync } from "../hooks/useEnvironmentCapabilitySync";
import {
  isLocalLoopbackLlmConfig,
  readLlmRuntimeConfigFromStorage,
} from "../services/postprocess/postprocessRuntimeContract";
import { refreshLlmOllamaDetect } from "../services/llm/llmEnvRuntimeStore";
import {
  projectAsrControllerFields,
  useProjectAsrBridgeStack,
} from "./useProjectAsrBridgeStack";
import { projectLifecycleControllerFields } from "./projectLifecycleControllerFields";
import type { AsrHealthState } from "./useAsrBridgeController";
import type { AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import {
  isTranscribeBusyReason,
  stabilizeAsrPresentationDuringTranscribe,
} from "../services/asr/asrPresentationTranscribeGuard";
import { runtimeInstallBusyPresentation } from "../services/asr/asrEnvStatus";
import { mergeArtifactBusyState } from "../services/asr/prepareJobPresentation";

export type { AsrHealthState, BusyReason };
export type ProjectControllerApi = ReturnType<typeof useProjectController>;

export function useProjectController() {
  const {
    asr,
    asrSetup,
    runtimeInstallRunning,
    refreshAsrHealth,
    refreshAsrModelCacheInfo,
    localTranscribePreflight,
  } = useProjectAsrBridgeStack();

  const lifecycle = useProjectLifecycleController(
    localTranscribePreflight,
    asr.sttOnlineRuntimeEpoch,
  );

  const lastStableAsrPresentationRef = useRef<AsrEnvPresentation | null>(null);
  const transcribeActive = lifecycle.busy && isTranscribeBusyReason(lifecycle.busyReason);
  const asrPresentation = useMemo(() => {
    const base = runtimeInstallRunning
      ? runtimeInstallBusyPresentation(asr.asrPresentation)
      : asr.asrPresentation;
    if (base.chipOk) {
      lastStableAsrPresentationRef.current = base;
    }
    return stabilizeAsrPresentationDuringTranscribe(
      base,
      lastStableAsrPresentationRef.current,
      transcribeActive,
    );
  }, [asr.asrPresentation, runtimeInstallRunning, transcribeActive]);

  useEnvironmentCapabilitySync({
    projectId: lifecycle.current?.id,
    refreshAsrHealth,
    refreshAsrModelCacheInfo,
    refreshSetupDiagnose: asrSetup.refreshSetupDiagnose,
    bumpLlmRuntimeChanged: lifecycle.bumpLlmRuntimeChanged,
    bumpSttOnlineRuntimeChanged: asr.bumpSttOnlineRuntimeChanged,
    refreshLlmOllamaDetect: async () => {
      const config = readLlmRuntimeConfigFromStorage();
      if (isLocalLoopbackLlmConfig(config)) {
        await refreshLlmOllamaDetect();
      }
    },
    getCacheOverlay: () => ({
      desktopModelsRoot: asr.asrModelCacheInfo?.models_root ?? null,
      asrModelCacheBytes: asr.asrModelCacheInfo?.total_bytes ?? 0,
    }),
    getAsrPresentationOverlay: () => ({
      selectedHubModelId: asr.localAsrModelCatalog.selectedHubModelId,
      catalogStatus: asr.localAsrModelCatalog.catalogStatus,
      sidecarAsyncTranscribeCapable: asr.localAsrModelCatalog.sidecarAsyncTranscribeCapable,
      prepareModelBusy: asr.prepareModelBusy,
      prepareModelCancelling: asr.prepareModelCancelling,
      prepareModelProgress: asr.prepareModelProgress,
      runtimeInstallRunning,
    }),
    deferRefreshWhileTranscribing: () =>
      mergeArtifactBusyState({
        transcribeBusy: lifecycle.busy && isTranscribeBusyReason(lifecycle.busyReason),
        prepareModelBusy: asr.prepareModelBusy,
        prepareModelCancelling: asr.prepareModelCancelling,
        runtimeInstallRunning,
        setupBusy: asrSetup.setupBusy,
        diagnoseBusy: asrSetup.diagnoseBusy,
      }).deferEnvRefresh,
  });

  return {
    ...projectLifecycleControllerFields(lifecycle),
    ...projectAsrControllerFields(asr, asrSetup),
    asrPresentation,
  };
}
