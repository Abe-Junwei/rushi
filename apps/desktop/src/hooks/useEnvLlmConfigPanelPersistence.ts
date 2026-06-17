import { useCallback, useEffect, useState } from "react";
import { toast } from "../services/ui/toast";
import { activateLocalOllamaPreset } from "../services/llm/llmEnvStatus";
import {
  DEFAULT_LLM_API_KEY_ID,
  applyLlmProviderPreset,
  getLlmProviderDefinition,
  isCorruptLlmApiKeyId,
  isLocalLoopbackLlmProvider,
  LLM_STORAGE_KEYS,
  persistLlmRuntimeConfig,
  readLastCloudRuntimeConfig,
  readLlmRuntimeConfigFromStorage,
  snapshotLastCloudRuntimeFromStorage,
  setLlmApiKeyInMemory,
  validateLlmConnectionDraft,
  normalizeLlmApiKeyId,
  type LlmProviderId,
} from "../services/postprocess/postprocessRuntimeContract";
import { llmDeleteApiKey, llmMigrateLegacyApiKey, llmSaveApiKey } from "../tauri/postprocessApi";

export type EnvLlmConfigFormFields = {
  providerId: LlmProviderId;
  baseUrl: string;
  model: string;
  apiKey: string;
  savedApiKeyId: string | null;
  legacyMisplacedKeyId: string | undefined;
};

export type UseEnvLlmConfigPanelPersistenceArgs = {
  fields: EnvLlmConfigFormFields;
  setProviderId: (v: LlmProviderId) => void;
  setBaseUrl: (v: string) => void;
  setModel: (v: string) => void;
  setApiKey: (v: string) => void;
  setSavedApiKeyId: (v: string | null) => void;
  setLegacyMisplacedKeyId: (v: string | undefined) => void;
  setKeychainRefreshSeq: React.Dispatch<React.SetStateAction<number>>;
  localLoopback: boolean;
  onLlmRuntimeChanged?: () => void;
  onInvalidateProbe: () => void;
};

export function useEnvLlmConfigPanelPersistence({
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
  onInvalidateProbe,
}: UseEnvLlmConfigPanelPersistenceArgs) {
  const { providerId, baseUrl, model, apiKey, savedApiKeyId, legacyMisplacedKeyId } = fields;
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    const rawApiKeyId = (localStorage.getItem(LLM_STORAGE_KEYS.apiKeyId) ?? "").trim();
    const legacyId = rawApiKeyId && isCorruptLlmApiKeyId(rawApiKeyId) ? rawApiKeyId : undefined;
    setLegacyMisplacedKeyId(legacyId);
    const c = readLlmRuntimeConfigFromStorage();
    setProviderId(c.providerId);
    setBaseUrl(c.baseUrl);
    setModel(c.model);
    setSavedApiKeyId(c.apiKeyId ?? null);
    if (legacyId) {
      void llmMigrateLegacyApiKey({ legacyApiKeyId: legacyId })
        .then((migrated) => {
          if (migrated) setKeychainRefreshSeq((n) => n + 1);
        })
        .catch(() => {
          /* ignore migration errors; user can re-save key */
        });
    } else {
      setKeychainRefreshSeq((n) => n + 1);
    }
  }, [setBaseUrl, setKeychainRefreshSeq, setLegacyMisplacedKeyId, setModel, setProviderId, setSavedApiKeyId]);

  const bumpKeychainCheck = useCallback(() => {
    setKeychainRefreshSeq((n) => n + 1);
  }, [setKeychainRefreshSeq]);

  const onProviderChange = useCallback(
    (next: LlmProviderId) => {
      setProviderId(next);
      const preset = applyLlmProviderPreset(next);
      setBaseUrl(preset.baseUrl);
      setModel(preset.model);
      onInvalidateProbe();
    },
    [onInvalidateProbe, setBaseUrl, setModel, setProviderId],
  );

  const selectLocalMode = useCallback(() => {
    if (isLocalLoopbackLlmProvider(providerId)) return;
    snapshotLastCloudRuntimeFromStorage();
    activateLocalOllamaPreset();
    const preset = applyLlmProviderPreset("ollama");
    setProviderId("ollama");
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
    setSavedApiKeyId(null);
    setApiKey("");
    onInvalidateProbe();
    toast.info("已切换 Ollama，请探测连接。");
    bumpKeychainCheck();
    onLlmRuntimeChanged?.();
  }, [
    bumpKeychainCheck,
    onInvalidateProbe,
    onLlmRuntimeChanged,
    providerId,
    setApiKey,
    setBaseUrl,
    setModel,
    setProviderId,
    setSavedApiKeyId,
  ]);

  const selectCloudMode = useCallback(() => {
    if (!isLocalLoopbackLlmProvider(providerId)) return;
    const restored = readLastCloudRuntimeConfig();
    const restoredDef = getLlmProviderDefinition(restored.providerId);
    persistLlmRuntimeConfig(restored);
    setProviderId(restored.providerId);
    setBaseUrl(restored.baseUrl);
    setModel(restored.model);
    setSavedApiKeyId(restored.apiKeyId ?? null);
    setApiKey("");
    onInvalidateProbe();
    const label = restoredDef?.label ?? "云端";
    toast.info(
      restored.apiKeyId
        ? `已切换到 ${label}，请探测连接。`
        : `已切换到 ${label}，请填写 Key 并保存。`,
    );
    bumpKeychainCheck();
    onLlmRuntimeChanged?.();
  }, [
    bumpKeychainCheck,
    onInvalidateProbe,
    onLlmRuntimeChanged,
    providerId,
    setApiKey,
    setBaseUrl,
    setModel,
    setProviderId,
    setSavedApiKeyId,
  ]);

  const save = useCallback(async () => {
    onInvalidateProbe();
    setSaveBusy(true);
    try {
      validateLlmConnectionDraft({ providerId, baseUrl, model });
      const typedApiKey = apiKey.trim();
      const rawStoredKeyId = savedApiKeyId ?? readLlmRuntimeConfigFromStorage().apiKeyId ?? undefined;
      const misplacedKeyId = legacyMisplacedKeyId;
      let nextApiKeyId = normalizeLlmApiKeyId(rawStoredKeyId);
      if (typedApiKey) {
        if (misplacedKeyId) {
          await llmDeleteApiKey({ apiKeyId: misplacedKeyId }).catch(() => {
            /* ignore missing legacy entries */
          });
        }
        const savedId = await llmSaveApiKey({
          apiKeyId: DEFAULT_LLM_API_KEY_ID,
          apiKey: typedApiKey,
        });
        nextApiKeyId = savedId;
        setLegacyMisplacedKeyId(undefined);
      } else if (misplacedKeyId) {
        const migrated = await llmMigrateLegacyApiKey({ legacyApiKeyId: misplacedKeyId });
        if (migrated) {
          nextApiKeyId = DEFAULT_LLM_API_KEY_ID;
          setLegacyMisplacedKeyId(undefined);
        }
      }
      if (localLoopback) {
        persistLlmRuntimeConfig({ providerId, baseUrl, model }, { clearApiKeyId: true });
        setSavedApiKeyId(null);
        setLlmApiKeyInMemory(null);
        setApiKey("");
        bumpKeychainCheck();
        onLlmRuntimeChanged?.();
        toast.success("已保存，请探测连接。");
        return;
      }
      if (!nextApiKeyId) {
        throw new Error("请先填写 API Key，再点击保存配置。");
      }
      persistLlmRuntimeConfig({
        providerId,
        baseUrl,
        model,
        apiKeyId: nextApiKeyId ?? DEFAULT_LLM_API_KEY_ID,
      });
      setSavedApiKeyId(nextApiKeyId ?? DEFAULT_LLM_API_KEY_ID);
      setLlmApiKeyInMemory(null);
      bumpKeychainCheck();
      onLlmRuntimeChanged?.();
      if (typedApiKey) {
        setApiKey("");
        toast.success("API Key 已保存。");
      } else if (nextApiKeyId) {
        toast.success("已保存，沿用已存 Key。");
      } else {
        toast.info("已保存配置，请填写 API Key。");
      }
    } catch (e) {
      toast.errorFromUnknown(e);
    } finally {
      setSaveBusy(false);
    }
  }, [
    apiKey,
    baseUrl,
    bumpKeychainCheck,
    legacyMisplacedKeyId,
    localLoopback,
    model,
    onInvalidateProbe,
    onLlmRuntimeChanged,
    providerId,
    savedApiKeyId,
    setApiKey,
    setLegacyMisplacedKeyId,
    setSavedApiKeyId,
  ]);

  const clearSavedApiKey = useCallback(async () => {
    if (!savedApiKeyId && !readLlmRuntimeConfigFromStorage().apiKeyId) return;
    onInvalidateProbe();
    setSaveBusy(true);
    try {
      const rawId = savedApiKeyId ?? readLlmRuntimeConfigFromStorage().apiKeyId;
      const ids = new Set<string>([DEFAULT_LLM_API_KEY_ID]);
      if (rawId?.trim()) ids.add(rawId.trim());
      for (const id of ids) {
        await llmDeleteApiKey({ apiKeyId: id }).catch(() => {
          /* ignore missing legacy entries */
        });
      }
      persistLlmRuntimeConfig({ providerId, baseUrl, model }, { clearApiKeyId: true });
      setSavedApiKeyId(null);
      setApiKey("");
      setLlmApiKeyInMemory(null);
      bumpKeychainCheck();
      onLlmRuntimeChanged?.();
      toast.success("已清除已保存的 API Key。");
    } catch (e) {
      toast.errorFromUnknown(e);
    } finally {
      setSaveBusy(false);
    }
  }, [
    baseUrl,
    bumpKeychainCheck,
    model,
    onInvalidateProbe,
    onLlmRuntimeChanged,
    providerId,
    savedApiKeyId,
    setApiKey,
    setSavedApiKeyId,
  ]);

  return {
    saveBusy,
    bumpKeychainCheck,
    onProviderChange,
    selectLocalMode,
    selectCloudMode,
    save,
    clearSavedApiKey,
  };
}
