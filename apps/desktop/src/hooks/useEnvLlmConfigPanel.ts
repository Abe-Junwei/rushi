import { useCallback, useMemo, useState } from "react";
import { useLlmKeychainReady } from "../hooks/useLlmKeychainReady";
import { useLlmEnvStatus } from "../hooks/useLlmEnvStatus";
import { useEnvLlmPromptConfig } from "../hooks/useEnvLlmPromptConfig";
import { resolveLlmEnvEffectiveConfig } from "../services/llm/llmEnvStatus";
import { ollamaDetectReady } from "../services/llm/llmEnvStatusTone";
import { toast } from "../services/ui/toast";
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
  const promptConfig = useEnvLlmPromptConfig();

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
    persistPromptDraft: promptConfig.persistDraft,
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

  const save = useCallback(async () => {
    const outcome = await persistence.save();
    if (outcome !== "probe") return;
    if (localLoopback) {
      const out = await refreshDetect();
      if (out.reachable && ollamaDetectReady(out)) {
        toast.success(out.message?.trim() || "Ollama 连接就绪。");
      } else {
        toast.error(out.message?.trim() || "Ollama 不可达，请确认本机服务已启动。");
      }
      return;
    }
    await probeHook.probe({ preferPersistedCredentials: true });
  }, [localLoopback, persistence.save, probeHook.probe, refreshDetect]);

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
    save,
    probe: probeHook.probe,
    clearSavedApiKey: persistence.clearSavedApiKey,
    keychainChecking,
    keychainReady,
    refreshDetect,
    detectBusy,
    modeToggleTones,
    promptConfig,
  };
}
