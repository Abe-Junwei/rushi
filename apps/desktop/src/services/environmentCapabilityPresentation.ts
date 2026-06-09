import type { AsrHealthRefreshResult } from "../pages/useAsrHealthPoll";
import { buildAsrEnvPresentation, type AsrEnvPresentation } from "./asr/asrEnvStatus";
import {
  parseCatalogStatusFromHealth,
  readStoredLocalAsrHubModelId,
  sidecarSupportsTranscribeAsyncFromRoot,
} from "./asr/localAsrModelCatalog";

export function buildEnvironmentCapabilityPresentation(input: {
  healthResult: AsrHealthRefreshResult | undefined;
  cacheOverlay?: {
    desktopModelsRoot?: string | null;
    asrModelCacheBytes?: number;
  };
}): AsrEnvPresentation {
  const { healthResult, cacheOverlay } = input;
  const catalogStatus = healthResult?.healthJson
    ? parseCatalogStatusFromHealth(healthResult.healthJson)
    : null;
  const sidecarAsync =
    healthResult?.rootJson !== undefined && healthResult.rootJson !== null
      ? sidecarSupportsTranscribeAsyncFromRoot(healthResult.rootJson)
      : undefined;

  return buildAsrEnvPresentation({
    asrHealth: healthResult?.health ?? "error",
    asrHealthDetail: healthResult?.healthDetail ?? "",
    asrCaps: healthResult?.caps ?? null,
    selectedHubModelId: readStoredLocalAsrHubModelId(),
    catalogStatus,
    desktopModelsRoot: cacheOverlay?.desktopModelsRoot ?? null,
    sidecarModelsRoot: healthResult?.caps?.rushi_models_root ?? null,
    asrModelCacheBytes: cacheOverlay?.asrModelCacheBytes ?? 0,
    sidecarAsyncTranscribeCapable: sidecarAsync,
  });
}
