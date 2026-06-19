import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  isLocalLoopbackLlmConfig,
  readLlmRuntimeConfigFromStorage,
} from "../services/postprocess/postprocessRuntimeContract";
import {
  buildLlmEnvPresentation,
  buildLlmModeToggleTones,
  readLlmEnvMode,
  readLlmEnvSnapshot,
  resolveLlmEnvEffectiveConfig,
  type LlmEnvPresentation,
  type LlmEnvSettingsOverlay,
} from "../services/llm/llmEnvStatus";
import {
  ensureLlmOllamaDetect,
  getLlmEnvRuntimeSnapshot,
  refreshLlmOllamaDetect,
  subscribeLlmEnvRuntime,
} from "../services/llm/llmEnvRuntimeStore";

function llmEnvModeFromOverlay(settings?: LlmEnvSettingsOverlay): "local" | "cloud" {
  if (settings?.configDraft) {
    return isLocalLoopbackLlmConfig(resolveLlmEnvEffectiveConfig(settings.configDraft)) ? "local" : "cloud";
  }
  return readLlmEnvMode();
}

export function useLlmEnvStatus(refreshSeq = 0, settings?: LlmEnvSettingsOverlay) {
  const runtime = useSyncExternalStore(subscribeLlmEnvRuntime, getLlmEnvRuntimeSnapshot, getLlmEnvRuntimeSnapshot);
  const [snapshot, setSnapshot] = useState(readLlmEnvSnapshot);
  const envMode = llmEnvModeFromOverlay(settings);

  /* eslint-disable react-hooks/exhaustive-deps -- we track individual configDraft fields to avoid rebuilding on every settings object mutation */
  const refreshDetect = useCallback(async () => {
    return refreshLlmOllamaDetect({ configDraft: settings?.configDraft });
  }, [settings?.configDraft?.model, settings?.configDraft?.providerId, settings?.configDraft?.baseUrl]);
  /* eslint-enable react-hooks/exhaustive-deps */

  useEffect(() => {
    setSnapshot(readLlmEnvSnapshot());
  }, [refreshSeq]);

  useEffect(() => {
    if (envMode !== "local") return;
    ensureLlmOllamaDetect({ refreshSeq, configDraft: settings?.configDraft });
  }, [
    refreshSeq,
    envMode,
    settings?.configDraft?.model,
    settings?.configDraft?.providerId,
    settings?.configDraft?.baseUrl,
    settings,
  ]);

  /* eslint-disable react-hooks/exhaustive-deps -- connectionVerifiedSeq is an epoch that forces refresh when LLM connection verification changes; it is intentionally not read inside the memo */
  const presentation: LlmEnvPresentation = useMemo(
    () =>
      buildLlmEnvPresentation({
        ollamaDetect: envMode === "local" ? runtime.ollamaDetect : null,
        ollamaDetectBusy: envMode === "local" ? runtime.ollamaDetectBusy : false,
        settings,
      }),
    [runtime.ollamaDetect, runtime.ollamaDetectBusy, runtime.connectionVerifiedSeq, settings, envMode],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  /* eslint-disable react-hooks/exhaustive-deps -- connectionVerifiedSeq is an epoch that forces refresh when LLM connection verification changes; it is intentionally not read inside the memo */
  const modeToggleTones = useMemo(
    () =>
      buildLlmModeToggleTones({
        ollamaDetect: runtime.ollamaDetect,
        ollamaDetectBusy: runtime.ollamaDetectBusy,
        settings,
      }),
    [runtime.ollamaDetect, runtime.ollamaDetectBusy, runtime.connectionVerifiedSeq, settings],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  const polishReadiness = useMemo(
    () => ({
      mode: presentation.mode,
      sourceLabel: presentation.sourceLabel,
      shortLabel: presentation.chipLabel,
      tone: presentation.tone,
      ready: presentation.ok,
      blockReason: presentation.blockReason,
    }),
    [presentation],
  );

  return {
    presentation,
    modeToggleTones,
    mode: presentation.mode,
    detect: runtime.ollamaDetect,
    detectBusy: runtime.ollamaDetectBusy,
    shortLabel: presentation.chipLabel,
    topBarOk: presentation.ok,
    polishReadiness,
    providerId: snapshot.providerId,
    model: readLlmRuntimeConfigFromStorage().model,
    refreshDetect,
    bumpLocalSnapshot: () => setSnapshot(readLlmEnvSnapshot()),
  };
}
