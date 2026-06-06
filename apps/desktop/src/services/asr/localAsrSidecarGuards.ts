import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import {
  DEFAULT_LOCAL_ASR_RECOGNITION_LANGUAGE,
  normalizeLocalAsrRecognitionLanguage,
  sidecarRecognitionLanguageMatchesSelection,
  type LocalAsrRecognitionLanguage,
} from "./localAsrRecognitionLanguage";
import {
  computeLocalAsrTranscribeReady,
  resolveLocalAsrHubModelId,
  type LocalAsrCatalogStatusItem,
} from "./localAsrModelCatalog";

export type LocalAsrSetupSelectionContext = {
  selectedHubModelId: string;
  catalogStatus?: LocalAsrCatalogStatusItem[] | null;
  recognitionLanguage?: LocalAsrRecognitionLanguage;
  /** When false, sidecar lacks R3e-C async transcribe — force restart path. */
  sidecarAsyncTranscribeCapable?: boolean;
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
  if (ctx.sidecarAsyncTranscribeCapable === false) return false;
  if (!caps?.funasr_ready) return false;
  const hub = resolveLocalAsrHubModelId(ctx.selectedHubModelId);
  const lang = normalizeLocalAsrRecognitionLanguage(
    ctx.recognitionLanguage ?? DEFAULT_LOCAL_ASR_RECOGNITION_LANGUAGE,
  );
  if (!sidecarRecognitionLanguageMatchesSelection(caps.funasr_language, lang)) {
    return false;
  }
  const loaded = caps.funasr_loaded_model_id?.trim();
  if (loaded && loaded !== hub) {
    return false;
  }
  return caps.funasr_model_id === hub && isLoopbackTranscribeReadyForSelection(caps, ctx);
}
