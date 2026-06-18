import { useMemo } from "react";
import {
  buildAsrEnvPresentation,
  type AsrEnvPresentation,
  type BuildAsrEnvPresentationInput,
} from "../services/asr/asrEnvStatus";

export function useAsrEnvStatus(input: BuildAsrEnvPresentationInput): AsrEnvPresentation {
  return useMemo(
    () => buildAsrEnvPresentation(input),
    [
      input.asrHealth,
      input.asrHealthDetail,
      input.asrCaps,
      input.selectedHubModelId,
      input.catalogStatus,
      input.desktopModelsRoot,
      input.sidecarModelsRoot,
      input.asrModelCacheBytes,
      input.sidecarAsyncTranscribeCapable,
    ],
  );
}
