import { useCallback, useEffect, useMemo, useState } from "react";
import { useLlmKeychainReady } from "../hooks/useLlmKeychainReady";
import { useLlmEnvStatus } from "../hooks/useLlmEnvStatus";
import { activateLocalOllamaPreset } from "../services/llm/llmEnvStatus";
import {
  DEFAULT_LLM_API_KEY_ID,
  OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY,
  applyLlmProviderPreset,
  getLlmProviderDefinition,
  isCorruptLlmApiKeyId,
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
  const [msg, setMsg] = useState<string | null>(null);
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
  const llmEnvMode: LlmEnvMode = localLoopback ? "local" : "cloud";
  const formBusy = busy || saveBusy || probeBusy;
  const hasLocalKeyRef = isLlmRuntimeReady();
  const { keychainReady, checking: keychainChecking } = useLlmKeychainReady(keychainRefreshSeq);

  const settingsOverlay = useMemo(
    () => ({
      hasLocalKeyRef,
      hasTypedKey: apiKey.trim().length > 0,
      keychainPresent: keychainChecking ? null : keychainReady,
    }),
    [apiKey, hasLocalKeyRef, keychainChecking, keychainReady],
  );

  const { presentation, refreshDetect, detectBusy } = useLlmEnvStatus(
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
    setMsg(null);
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
    setMsg("已切换到本机 Ollama。请确认上方检测就绪后点击「探测连接」。");
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
    setMsg(
      restored.apiKeyId
        ? `已切换到云端 API（${label}）。请确认配置后点击「探测连接」。`
        : `已切换到云端 API（${label}）。请填写 API Key 并保存，再点击「探测连接」。`,
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
    setMsg(null);
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
        setMsg("已保存本机 Ollama 连接。无需 API Key；请点击「探测连接」验证。");
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
        setMsg("已保存。API Key 已写入本地受保护存储；当前页面不再保留明文。");
      } else if (nextApiKeyId) {
        setMsg("已保存连接信息，将继续使用本地已保存的 API Key。");
      } else {
        setMsg("已保存连接信息。请填写 API Key 并保存。");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
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
    setMsg(null);
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
      setMsg("已清除本地保存的 API Key。");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }, [baseUrl, bumpKeychainCheck, model, onLlmRuntimeChanged, providerId, savedApiKeyId]);

  const probe = useCallback(async () => {
    setMsg(null);
    setProbeBusy(true);
    try {
      const runtime = buildProbeRuntime();
      const out = await llmProbeConnection({ runtime });
      setProbeFailed(!out.ok);
      if (out.ok) {
        markLlmConnectionVerified();
        onLlmRuntimeChanged?.();
      }
      setMsg(out.ok ? `${out.message}（约 ${out.latency_ms ?? "?"} ms）` : out.message);
    } catch (e) {
      setProbeFailed(true);
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setProbeBusy(false);
    }
  }, [buildProbeRuntime, onLlmRuntimeChanged]);

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
    msg,
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
  };
}
