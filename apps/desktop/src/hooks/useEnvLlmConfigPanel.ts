import { useCallback, useEffect, useMemo, useState } from "react";
import { useLlmKeychainReady } from "../hooks/useLlmKeychainReady";
import { useLlmEnvStatus } from "../hooks/useLlmEnvStatus";
import { toast } from "../services/ui/toast";
import { waitMinVisibleBusy } from "../services/ui/minVisibleBusy";
import { activateLocalOllamaPreset, resolveLlmEnvEffectiveConfig } from "../services/llm/llmEnvStatus";
import {
  DEFAULT_LLM_API_KEY_ID,
  OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY,
  applyLlmProviderPreset,
  getLlmProviderDefinition,
  isCorruptLlmApiKeyId,
  isLocalLoopbackLlmConfig,
  isLocalLoopbackLlmProvider,
  isLlmRuntimeReady,
  LLM_STORAGE_KEYS,
  persistLlmRuntimeConfig,
  readLastCloudRuntimeConfig,
  readLlmRuntimeConfigFromStorage,
  snapshotLastCloudRuntimeFromStorage,
  setLlmApiKeyInMemory,
  tryBuildPostprocessRuntimeBridge,
  validateLlmConnectionDraft,
  markLlmConnectionVerified,
  normalizeLlmApiKeyId,
  type LlmProviderId,
  type PostprocessRuntimeBridge,
} from "../services/postprocess/postprocessRuntimeContract";
import { llmDeleteApiKey, llmMigrateLegacyApiKey, llmProbeConnection, llmSaveApiKey } from "../tauri/postprocessApi";
import type { LlmEnvMode } from "../services/llm/llmEnvStatus";

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
  const [saveBusy, setSaveBusy] = useState(false);
  const [probeBusy, setProbeBusy] = useState(false);
  const [probeFailed, setProbeFailed] = useState(false);
  const [keychainRefreshSeq, setKeychainRefreshSeq] = useState(0);

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
  }, []);

  const def = getLlmProviderDefinition(providerId);
  const localLoopback = isLocalLoopbackLlmProvider(providerId);
  const llmEnvMode: LlmEnvMode = isLocalLoopbackLlmConfig(
    resolveLlmEnvEffectiveConfig({ providerId, baseUrl, model }),
  )
    ? "local"
    : "cloud";
  const formBusy = busy || saveBusy || probeBusy;
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

  const bumpKeychainCheck = useCallback(() => {
    setKeychainRefreshSeq((n) => n + 1);
  }, []);

  const invalidateProbe = useCallback(() => {
    setProbeFailed(false);
  }, []);

  const onProviderChange = useCallback((next: LlmProviderId) => {
    setProviderId(next);
    const preset = applyLlmProviderPreset(next);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
    setProbeFailed(false);
  }, []);

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
    setProbeFailed(false);
    toast.info("已切换 Ollama，请探测连接。");
    bumpKeychainCheck();
    onLlmRuntimeChanged?.();
  }, [bumpKeychainCheck, onLlmRuntimeChanged, providerId]);

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
    setProbeFailed(false);
    const label = restoredDef?.label ?? "云端";
    toast.info(
      restored.apiKeyId
        ? `已切换到 ${label}，请探测连接。`
        : `已切换到 ${label}，请填写 Key 并保存。`,
    );
    bumpKeychainCheck();
    onLlmRuntimeChanged?.();
  }, [bumpKeychainCheck, onLlmRuntimeChanged, providerId]);

  const buildProbeRuntime = useCallback((): PostprocessRuntimeBridge => {
    const typedApiKey = apiKey.trim();
    if (!def) throw new Error("未知的 LLM 厂商预设。");
    const stored = readLlmRuntimeConfigFromStorage();
    const resolvedBaseUrl = baseUrl.trim() || stored.baseUrl || def.defaultBaseUrl;
    const resolvedModel = model.trim() || stored.model || def.defaultModel;
    const allowInsecureHttp =
      resolvedBaseUrl.startsWith("http://127.0.0.1") ||
      resolvedBaseUrl.startsWith("http://localhost");
    if (localLoopback) {
      return {
        provider: def.label,
        baseUrl: resolvedBaseUrl,
        model: resolvedModel,
        apiKey: typedApiKey || OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY,
        allowInsecureHttp: true,
      };
    }
    if (typedApiKey) {
      const runtime: PostprocessRuntimeBridge = {
        provider: def.label,
        baseUrl: resolvedBaseUrl,
        model: resolvedModel,
        apiKey: typedApiKey,
      };
      if (allowInsecureHttp) runtime.allowInsecureHttp = true;
      return runtime;
    }
    const bridge = tryBuildPostprocessRuntimeBridge();
    if (!bridge) {
      throw new Error("请先填写 API Key，或使用已保存的本地密钥。");
    }
    return bridge;
  }, [apiKey, baseUrl, def, localLoopback, model]);

  const save = useCallback(async () => {
    setProbeFailed(false);
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
    onLlmRuntimeChanged,
    providerId,
    savedApiKeyId,
  ]);

  const clearSavedApiKey = useCallback(async () => {
    if (!savedApiKeyId && !readLlmRuntimeConfigFromStorage().apiKeyId) return;
    setProbeFailed(false);
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
  }, [baseUrl, bumpKeychainCheck, model, onLlmRuntimeChanged, providerId, savedApiKeyId]);

  const probe = useCallback(async () => {
    const startedAt = Date.now();
    setProbeBusy(true);
    try {
      const runtime = buildProbeRuntime();
      const out = await llmProbeConnection({ runtime });
      setProbeFailed(!out.ok);
      if (out.ok) {
        if (!def) throw new Error("未知的 LLM 厂商预设。");
        const typedApiKey = apiKey.trim();
        let nextApiKeyId = normalizeLlmApiKeyId(savedApiKeyId ?? readLlmRuntimeConfigFromStorage().apiKeyId);
        if (!localLoopback && typedApiKey) {
          if (legacyMisplacedKeyId) {
            await llmDeleteApiKey({ apiKeyId: legacyMisplacedKeyId }).catch(() => {
              /* ignore missing legacy entries */
            });
          }
          nextApiKeyId = await llmSaveApiKey({
            apiKeyId: DEFAULT_LLM_API_KEY_ID,
            apiKey: typedApiKey,
          });
          setLegacyMisplacedKeyId(undefined);
          setSavedApiKeyId(nextApiKeyId);
          setApiKey("");
        }
        const probedConfig = {
          providerId,
          baseUrl: baseUrl.trim() || def.defaultBaseUrl,
          model: model.trim() || def.defaultModel,
          ...(localLoopback ? {} : { apiKeyId: nextApiKeyId ?? DEFAULT_LLM_API_KEY_ID }),
        };
        if (localLoopback) {
          persistLlmRuntimeConfig(probedConfig, { clearApiKeyId: true });
        } else {
          if (!nextApiKeyId) {
            throw new Error("请先填写 API Key，再点击探测连接。");
          }
          persistLlmRuntimeConfig({ ...probedConfig, apiKeyId: nextApiKeyId });
        }
        markLlmConnectionVerified(probedConfig);
        bumpKeychainCheck();
        onLlmRuntimeChanged?.();
      }
      if (out.ok) {
        toast.success(`${out.message}（约 ${out.latency_ms ?? "?"} ms）`);
      } else {
        toast.error(out.message);
      }
    } catch (e) {
      setProbeFailed(true);
      toast.errorFromUnknown(e);
    } finally {
      await waitMinVisibleBusy(startedAt);
      setProbeBusy(false);
    }
  }, [
    apiKey,
    baseUrl,
    buildProbeRuntime,
    bumpKeychainCheck,
    def,
    legacyMisplacedKeyId,
    localLoopback,
    model,
    onLlmRuntimeChanged,
    providerId,
    savedApiKeyId,
  ]);

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
    probeBusy,
    probeFailed,
    selectLocalMode,
    selectCloudMode,
    onProviderChange,
    setBaseUrl,
    setModel,
    setApiKey,
    invalidateProbe,
    save,
    probe,
    clearSavedApiKey,
    keychainChecking,
    keychainReady,
    refreshDetect,
    detectBusy,
    modeToggleTones,
  };
}
