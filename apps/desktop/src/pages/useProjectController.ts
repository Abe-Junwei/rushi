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

export type { AsrHealthState, BusyReason };
export type ProjectControllerApi = ReturnType<typeof useProjectController>;

export function useProjectController() {
  const {
    asr,
    asrSetup,
    refreshAsrHealth,
    refreshAsrModelCacheInfo,
    localTranscribePreflight,
  } = useProjectAsrBridgeStack();

  const lifecycle = useProjectLifecycleController(
    localTranscribePreflight,
    asr.sttOnlineRuntimeEpoch,
  );

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
    }),
  });

  return {
    ...projectLifecycleControllerFields(lifecycle),
    ...projectAsrControllerFields(asr, asrSetup),
  };
}
