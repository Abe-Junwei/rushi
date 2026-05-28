import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import {
  computeLocalAsrTranscribeReady,
  resolveLocalAsrHubModelId,
  type LocalAsrCatalogStatusItem,
} from "./localAsrModelCatalog";

export type LocalAsrSetupSelectionContext = {
  selectedHubModelId: string;
  catalogStatus?: LocalAsrCatalogStatusItem[] | null;
};

/** Loopback + UI selection aligned transcribe-ready (same rule as EnvLocalAsrPanel). */
export function isLoopbackTranscribeReadyForSelection(
  caps: AsrHealthCapabilities | null | undefined,
  ctx: LocalAsrSetupSelectionContext,
): boolean {
  if (!caps) return false;
  const hub = resolveLocalAsrHubModelId(ctx.selectedHubModelId);
  const { ready, sidecarMatchesSelection } = computeLocalAsrTranscribeReady({
    asrHealth: "ok",
    asrCaps: caps,
    selectedHubModelId: hub,
    catalogStatus: ctx.catalogStatus ?? null,
  });
  return ready && sidecarMatchesSelection;
}

/**
 * True when sidecar already runs the UI-selected hub and is transcribe-ready —
 * callers must not force_restart / retry bundled.
 */
export function shouldSkipSidecarRestartForSelection(
  caps: AsrHealthCapabilities | null | undefined,
  ctx: LocalAsrSetupSelectionContext,
): boolean {
  if (!caps?.funasr_ready || !caps.ready_for_transcribe) return false;
  const hub = resolveLocalAsrHubModelId(ctx.selectedHubModelId);
  return caps.funasr_model_id === hub && isLoopbackTranscribeReadyForSelection(caps, ctx);
}
