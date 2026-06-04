import {
  computeLocalAsrTranscribeReady,
  type LocalAsrTranscribeReadyInput,
} from "./localAsrModelCatalog";
import { buildAsrEnvPresentation, type BuildAsrEnvPresentationInput } from "./asrEnvStatus";

export type LocalAsrTranscribePreflightInput = LocalAsrTranscribeReadyInput & {
  asrHealthDetail?: string;
  /** From GET / during health poll; false when sidecar lacks R3e-C async routes. */
  sidecarAsyncTranscribeCapable?: boolean;
};

export function localAsrTranscribePreflightMessage(
  input: LocalAsrTranscribePreflightInput,
): string | null {
  const payload: BuildAsrEnvPresentationInput = {
    asrHealth: input.asrHealth,
    asrHealthDetail: input.asrHealthDetail ?? "",
    asrCaps: input.asrCaps as BuildAsrEnvPresentationInput["asrCaps"],
    selectedHubModelId: input.selectedHubModelId,
    catalogStatus: input.catalogStatus,
    sidecarAsyncTranscribeCapable: input.sidecarAsyncTranscribeCapable,
  };
  return buildAsrEnvPresentation(payload).blockReason;
}

export { computeLocalAsrTranscribeReady };
