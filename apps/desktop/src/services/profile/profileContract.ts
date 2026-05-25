import {
  getLlmProviderDefinition,
  persistLlmRuntimeConfig,
  readLlmRuntimeConfigFromStorage,
  type LlmProviderId,
} from "../postprocess/postprocessRuntimeContract";
import {
  getSttOnlineProviderDefinition,
  persistExternalSttOnlineRuntimeConfig,
  readExternalSttOnlineRuntimeConfigFromStorage,
} from "../stt/sttOnlineProviderContract";

export type SettingsProfileV1 = {
  version: number;
  llm?: {
    provider_id: LlmProviderId;
    base_url: string;
    model: string;
    api_key_id?: string;
  };
  online_stt?: {
    enabled: boolean;
    provider_id: string;
    endpoint?: string;
    app_key?: string;
    timeout_ms: number;
  };
};

export function buildSettingsProfileV1(): SettingsProfileV1 {
  const llm = readLlmRuntimeConfigFromStorage();
  const stt = readExternalSttOnlineRuntimeConfigFromStorage();
  return {
    version: 1,
    llm: {
      provider_id: llm.providerId,
      base_url: llm.baseUrl,
      model: llm.model,
      ...(llm.apiKeyId ? { api_key_id: llm.apiKeyId } : {}),
    },
    online_stt: {
      enabled: stt.enabled,
      provider_id: stt.selectedProviderId,
      ...(stt.endpoint ? { endpoint: stt.endpoint } : {}),
      ...(stt.appKey ? { app_key: stt.appKey } : {}),
      timeout_ms: stt.timeoutMs,
    },
  };
}

export function applySettingsProfileV1(profile: SettingsProfileV1): void {
  if (profile.version !== 1) {
    throw new Error(`仅支持导入 version=1 的 profile，当前为 ${profile.version}。`);
  }

  if (profile.llm) {
    if (!getLlmProviderDefinition(profile.llm.provider_id)) {
      throw new Error(`不支持的 LLM provider：${profile.llm.provider_id}`);
    }
    persistLlmRuntimeConfig({
      providerId: profile.llm.provider_id,
      baseUrl: profile.llm.base_url,
      model: profile.llm.model,
      apiKeyId: profile.llm.api_key_id,
    });
  }

  if (profile.online_stt) {
    if (!getSttOnlineProviderDefinition(profile.online_stt.provider_id)) {
      throw new Error(`不支持的在线 STT provider：${profile.online_stt.provider_id}`);
    }
    persistExternalSttOnlineRuntimeConfig({
      enabled: profile.online_stt.enabled,
      selectedProviderId: profile.online_stt.provider_id,
      endpoint: profile.online_stt.endpoint,
      appKey: profile.online_stt.app_key,
      timeoutMs: profile.online_stt.timeout_ms,
    });
  }
}
