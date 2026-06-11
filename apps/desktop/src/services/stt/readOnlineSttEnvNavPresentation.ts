import {
  buildOnlineSttEnvPresentation,
  type OnlineSttEnvPresentation,
  type OnlineSttEnvTone,
} from "./onlineSttEnvStatus";
import {
  hasSttOnlineApiKeyReference,
  isSttConnectionVerified,
  normalizeExternalSttOnlineRuntimeConfig,
  readExternalSttOnlineRuntimeConfigFromStorage,
} from "./sttOnlineProviderContract";

/** 设置侧栏在线 STT 状态点（读持久化 + 会话密钥，不含表单草稿）。 */
export function readOnlineSttEnvNavTone(): OnlineSttEnvTone {
  return readOnlineSttEnvNavPresentation().tone;
}

export function readOnlineSttEnvNavPresentation(): OnlineSttEnvPresentation {
  const stored = readExternalSttOnlineRuntimeConfigFromStorage();
  const draftConfig = normalizeExternalSttOnlineRuntimeConfig({
    enabled: true,
    selectedProviderId: stored.selectedProviderId,
    endpoint: stored.endpoint ?? "",
    appKey: stored.appKey ?? "",
    apiKeyId: stored.apiKeyId,
    timeoutMs: stored.timeoutMs,
  });
  return buildOnlineSttEnvPresentation({
    enabled: true,
    providerId: stored.selectedProviderId,
    endpoint: stored.endpoint ?? "",
    appKey: stored.appKey ?? "",
    hasApiKeyReference: hasSttOnlineApiKeyReference(),
    hasTypedApiKey: false,
    keychainReady: null,
    connectionVerified: isSttConnectionVerified(draftConfig),
    lastProbeAvailable: null,
    lastProbeMessage: null,
  });
}
