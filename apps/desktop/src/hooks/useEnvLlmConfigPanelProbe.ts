import { useCallback, useState } from "react";
import { toast } from "../services/ui/toast";
import { waitMinVisibleBusy } from "../services/ui/minVisibleBusy";
import {
  DEFAULT_LLM_API_KEY_ID,
  isLocalLoopbackLlmProvider,
  OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY,
  persistLlmRuntimeConfig,
  readLlmRuntimeConfigFromStorage,
  tryBuildPostprocessRuntimeBridge,
  markLlmConnectionVerified,
  normalizeLlmApiKeyId,
  type LlmProviderDefinition,
  type LlmProviderId,
  type PostprocessRuntimeBridge,
} from "../services/postprocess/postprocessRuntimeContract";
import { llmDeleteApiKey, llmProbeConnection, llmSaveApiKey } from "../tauri/postprocessApi";
import type { EnvLlmConfigFormFields } from "./useEnvLlmConfigPanelPersistence";

export type UseEnvLlmConfigPanelProbeArgs = {
  fields: EnvLlmConfigFormFields;
  def: LlmProviderDefinition | undefined;
  localLoopback: boolean;
  setApiKey: (v: string) => void;
  setSavedApiKeyId: (v: string | null) => void;
  setLegacyMisplacedKeyId: (v: string | undefined) => void;
  bumpKeychainCheck: () => void;
  onLlmRuntimeChanged?: () => void;
};

export function useEnvLlmConfigPanelProbe({
  fields,
  def,
  localLoopback,
  setApiKey,
  setSavedApiKeyId,
  setLegacyMisplacedKeyId,
  bumpKeychainCheck,
  onLlmRuntimeChanged,
}: UseEnvLlmConfigPanelProbeArgs) {
  const { providerId, baseUrl, model, apiKey, savedApiKeyId, legacyMisplacedKeyId } = fields;
  const [probeBusy, setProbeBusy] = useState(false);
  const [probeFailed, setProbeFailed] = useState(false);

  const invalidateProbe = useCallback(() => {
    setProbeFailed(false);
  }, []);

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
    setApiKey,
    setLegacyMisplacedKeyId,
    setSavedApiKeyId,
  ]);

  return {
    probeBusy,
    probeFailed,
    invalidateProbe,
    probe,
  };
}

export function isEnvLlmLocalLoopback(providerId: LlmProviderId): boolean {
  return isLocalLoopbackLlmProvider(providerId);
}
