import type { AsrHealthRefreshResult } from "../pages/useAsrHealthPoll";
import {
  buildAsrEnvPresentation,
  type AsrEnvPresentation,
  type BuildAsrEnvPresentationInput,
} from "./asr/asrEnvStatus";
import {
  parseCatalogStatusFromHealth,
  readStoredLocalAsrHubModelId,
  sidecarSupportsTranscribeAsyncFromRoot,
} from "./asr/localAsrModelCatalog";

/** 与 useAsrBridgeController 对齐的 ASR presentation 扩展输入（避免 coordinator 分叉）。 */
export type AsrPresentationOverlay = Pick<
  BuildAsrEnvPresentationInput,
  | "prepareModelBusy"
  | "prepareModelCancelling"
  | "prepareModelProgress"
  | "runtimeInstallRunning"
  | "selectedHubModelId"
  | "catalogStatus"
  | "sidecarAsyncTranscribeCapable"
>;

export function buildEnvironmentCapabilityPresentation(input: {
  healthResult: AsrHealthRefreshResult | undefined;
  cacheOverlay?: {
    desktopModelsRoot?: string | null;
    asrModelCacheBytes?: number;
  };
  asrOverlay?: AsrPresentationOverlay;
}): AsrEnvPresentation {
  const { healthResult, cacheOverlay, asrOverlay } = input;
  const catalogFromHealth = healthResult?.healthJson
    ? parseCatalogStatusFromHealth(healthResult.healthJson)
    : null;
  const sidecarAsyncFromRoot =
    healthResult?.rootJson !== undefined && healthResult.rootJson !== null
      ? sidecarSupportsTranscribeAsyncFromRoot(healthResult.rootJson)
      : undefined;

  return buildAsrEnvPresentation({
    asrHealth: healthResult?.health ?? "error",
    asrHealthDetail: healthResult?.healthDetail ?? "",
    asrCaps: healthResult?.caps ?? null,
    selectedHubModelId: asrOverlay?.selectedHubModelId ?? readStoredLocalAsrHubModelId(),
    catalogStatus: asrOverlay?.catalogStatus ?? catalogFromHealth,
    desktopModelsRoot: cacheOverlay?.desktopModelsRoot ?? null,
    sidecarModelsRoot: healthResult?.caps?.rushi_models_root ?? null,
    asrModelCacheBytes: cacheOverlay?.asrModelCacheBytes ?? 0,
    sidecarAsyncTranscribeCapable:
      asrOverlay?.sidecarAsyncTranscribeCapable ?? sidecarAsyncFromRoot,
    prepareModelBusy: asrOverlay?.prepareModelBusy,
    prepareModelCancelling: asrOverlay?.prepareModelCancelling,
    prepareModelProgress: asrOverlay?.prepareModelProgress,
    runtimeInstallRunning: asrOverlay?.runtimeInstallRunning,
  });
}
