import { useCallback, useEffect, useMemo, useState } from "react";
import { ollamaDetectStatus, type OllamaDetectResponse } from "../tauri/postprocessApi";
import {
  applyLlmProviderPreset,
  LLM_CONNECTION_VERIFIED_EVENT,
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

function llmEnvModeFromOverlay(settings?: LlmEnvSettingsOverlay): "local" | "cloud" {
  if (settings?.configDraft) {
    return isLocalLoopbackLlmConfig(resolveLlmEnvEffectiveConfig(settings.configDraft)) ? "local" : "cloud";
  }
  return readLlmEnvMode();
}

export function useLlmEnvStatus(refreshSeq = 0, settings?: LlmEnvSettingsOverlay) {
  const [snapshot, setSnapshot] = useState(readLlmEnvSnapshot);
  const [detect, setDetect] = useState<OllamaDetectResponse | null>(null);
  const [detectBusy, setDetectBusy] = useState(false);
  const [connectionVerifiedSeq, setConnectionVerifiedSeq] = useState(0);
  const envMode = llmEnvModeFromOverlay(settings);

  const refreshDetect = useCallback(async () => {
    setDetectBusy(true);
    try {
      const cfg = resolveLlmEnvEffectiveConfig(settings?.configDraft);
      const probeModel =
        llmEnvModeFromOverlay(settings) === "local"
          ? cfg.model
          : applyLlmProviderPreset("ollama").model;
      const out = await ollamaDetectStatus({ model: probeModel });
      setDetect(out);
    } catch (e) {
      setDetect({
        reachable: false,
        modelCount: 0,
        hasQwen25_7b: false,
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setDetectBusy(false);
    }
  }, [settings?.configDraft?.model, settings?.configDraft?.providerId, settings?.configDraft?.baseUrl, settings]);

  useEffect(() => {
    setSnapshot(readLlmEnvSnapshot());
  }, [refreshSeq]);

  useEffect(() => {
    const bumpConnectionVerified = () => setConnectionVerifiedSeq((n) => n + 1);
    bumpConnectionVerified();
    window.addEventListener(LLM_CONNECTION_VERIFIED_EVENT, bumpConnectionVerified);
    return () => window.removeEventListener(LLM_CONNECTION_VERIFIED_EVENT, bumpConnectionVerified);
  }, []);

  useEffect(() => {
    void refreshDetect();
  }, [refreshDetect, refreshSeq]);

  const presentation: LlmEnvPresentation = useMemo(
    () =>
      buildLlmEnvPresentation({
        ollamaDetect: envMode === "local" ? detect : null,
        ollamaDetectBusy: envMode === "local" ? detectBusy : false,
        settings,
      }),
    [detect, detectBusy, settings, connectionVerifiedSeq, refreshSeq, envMode],
  );

  const modeToggleTones = useMemo(
    () =>
      buildLlmModeToggleTones({
        ollamaDetect: detect,
        ollamaDetectBusy: detectBusy,
        settings,
      }),
    [detect, detectBusy, settings, connectionVerifiedSeq, refreshSeq],
  );

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
    detect,
    detectBusy,
    shortLabel: presentation.chipLabel,
    topBarOk: presentation.ok,
    polishReadiness,
    providerId: snapshot.providerId,
    model: readLlmRuntimeConfigFromStorage().model,
    refreshDetect,
    bumpLocalSnapshot: () => setSnapshot(readLlmEnvSnapshot()),
  };
}
