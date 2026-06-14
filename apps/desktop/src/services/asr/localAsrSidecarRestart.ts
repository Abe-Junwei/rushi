import * as projectApi from "../../tauri/projectApi";
import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import { pollLoopbackHealthUntil } from "./asrHealthSnapshot";
import {
  normalizeLocalAsrRecognitionLanguage,
  sidecarRecognitionLanguageMatchesSelection,
} from "./localAsrRecognitionLanguage";
import { migrateDeprecatedHubModelId, resolveLocalAsrHubModelId } from "./localAsrModelCatalog";

/** Sidecar env/config matches UI hub (loaded weight may still be warming). */
export function sidecarConfigMatchesHub(
  caps: AsrHealthCapabilities,
  hub: string,
  language: string,
): boolean {
  const targetHub = migrateDeprecatedHubModelId(hub);
  const loaded = caps.funasr_loaded_model_id?.trim();
  if (loaded && loaded !== targetHub) {
    return false;
  }
  const configured = migrateDeprecatedHubModelId(caps.funasr_model_id?.trim() || "");
  return (
    configured === targetHub &&
    sidecarRecognitionLanguageMatchesSelection(
      caps.funasr_language,
      normalizeLocalAsrRecognitionLanguage(language),
    )
  );
}

export async function writeLocalAsrPrefs(hub: string, language: string): Promise<void> {
  const resolved = resolveLocalAsrHubModelId(hub);
  await projectApi.setLocalAsrRecognitionLanguagePref(language, { restartSidecar: false });
  await projectApi.setLocalAsrHubModelPref(resolved, { restartSidecar: false });
}

/** Restart loopback ASR (bundled or source venv in desktop:dev). */
export async function restartLoopbackAsrSidecar(): Promise<void> {
  await projectApi.retryBundledAsrSidecar();
}

export type WaitSidecarConfigOptions = {
  hub: string;
  language: string;
  deadlineMs?: number;
  intervalMs?: number;
};

export async function waitForSidecarConfig(
  options: WaitSidecarConfigOptions,
): Promise<AsrHealthCapabilities | null> {
  const hub = resolveLocalAsrHubModelId(options.hub);
  const language = options.language;
  return pollLoopbackHealthUntil({
    deadlineMs: options.deadlineMs ?? 90_000,
    intervalMs: options.intervalMs ?? 1_000,
    predicate: (c) => sidecarConfigMatchesHub(c, hub, language),
  });
}
