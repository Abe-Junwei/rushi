import { useMemo, useState } from "react";
import { useLlmKeychainReady } from "../hooks/useLlmKeychainReady";
import { useLlmEnvStatus } from "../hooks/useLlmEnvStatus";
import { resolveLlmEnvEffectiveConfig } from "../services/llm/llmEnvStatus";
import {
  getLlmProviderDefinition,
  isLocalLoopbackLlmConfig,
  isLlmRuntimeReady,
  type LlmProviderId,
} from "../services/postprocess/postprocessRuntimeContract";
import type { LlmEnvMode } from "../services/llm/llmEnvStatus";
import { useEnvLlmConfigPanelPersistence } from "./useEnvLlmConfigPanelPersistence";
import { isEnvLlmLocalLoopback, useEnvLlmConfigPanelProbe } from "./useEnvLlmConfigPanelProbe";

export type UseEnvLlmConfigPanelArgs = {
  busy: boolean;
  onLlmRuntimeChanged?: () => void;
};

export function useEnvLlmConfigPanel({ busy, onLlmRuntimeChanged }: UseEnvLlmConfigPanelArgs) {
  const [providerId, setProviderId] = useState<LlmProviderId>("deepseek");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [savedApiKeyId, setSavedApiKeyId] = useState<string | null>(null);
  const [legacyMisplacedKeyId, setLegacyMisplacedKeyId] = useState<string | undefined>(undefined);
  const [keychainRefreshSeq, setKeychainRefreshSeq] = useState(0);

  const fields = useMemo(
    () => ({ providerId, baseUrl, model, apiKey, savedApiKeyId, legacyMisplacedKeyId }),
    [apiKey, baseUrl, legacyMisplacedKeyId, model, providerId, savedApiKeyId],
  );

  const def = getLlmProviderDefinition(providerId);
  const localLoopback = isEnvLlmLocalLoopback(providerId);
  const llmEnvMode: LlmEnvMode = isLocalLoopbackLlmConfig(
    resolveLlmEnvEffectiveConfig({ providerId, baseUrl, model }),
  )
    ? "local"
    : "cloud";

  const probeHook = useEnvLlmConfigPanelProbe({
    fields,
    def,
    localLoopback,
    setApiKey,
    setSavedApiKeyId,
    setLegacyMisplacedKeyId,
    bumpKeychainCheck: () => setKeychainRefreshSeq((n) => n + 1),
    onLlmRuntimeChanged,
  });

  const persistence = useEnvLlmConfigPanelPersistence({
    fields,
    setProviderId,
    setBaseUrl,
    setModel,
    setApiKey,
    setSavedApiKeyId,
    setLegacyMisplacedKeyId,
    setKeychainRefreshSeq,
    localLoopback,
    onLlmRuntimeChanged,
    onInvalidateProbe: probeHook.invalidateProbe,
  });

  const formBusy = busy || persistence.saveBusy || probeHook.probeBusy;
  const { keychainReady, checking: keychainChecking } = useLlmKeychainReady(keychainRefreshSeq);

  const settingsOverlay = useMemo(
    () => ({
      hasLocalKeyRef: isLlmRuntimeReady() || (!localLoopback && apiKey.trim().length > 0),
      hasTypedKey: apiKey.trim().length > 0,
      keychainPresent: keychainChecking ? null : keychainReady,
      configDraft: { providerId, baseUrl, model },
    }),
    [apiKey, baseUrl, keychainChecking, keychainReady, localLoopback, model, providerId],
  );

  const { presentation, refreshDetect, detectBusy, modeToggleTones } = useLlmEnvStatus(
    keychainRefreshSeq,
    settingsOverlay,
  );

  return {
    llmEnvMode,
    formBusy,
    presentation,
    localLoopback,
    providerId,
    baseUrl,
    model,
    apiKey,
    savedApiKeyId,
    def,
    probeBusy: probeHook.probeBusy,
    probeFailed: probeHook.probeFailed,
    selectLocalMode: persistence.selectLocalMode,
    selectCloudMode: persistence.selectCloudMode,
    onProviderChange: persistence.onProviderChange,
    setBaseUrl,
    setModel,
    setApiKey,
    invalidateProbe: probeHook.invalidateProbe,
    save: persistence.save,
    probe: probeHook.probe,
    clearSavedApiKey: persistence.clearSavedApiKey,
    keychainChecking,
    keychainReady,
    refreshDetect,
    detectBusy,
    modeToggleTones,
  };
}
