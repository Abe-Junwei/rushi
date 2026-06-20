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
export function readOnlineSttEnvNavTone(keychainReady: boolean | null = null): OnlineSttEnvTone {
  return readOnlineSttEnvNavPresentation(keychainReady).tone;
}

export function readOnlineSttEnvNavPresentation(
  keychainReady: boolean | null = null,
): OnlineSttEnvPresentation {
  const stored = readExternalSttOnlineRuntimeConfigFromStorage();
  const draftConfig = normalizeExternalSttOnlineRuntimeConfig({
    ...stored,
    enabled: true,
  });
  return buildOnlineSttEnvPresentation({
    enabled: stored.enabled,
    providerId: draftConfig.selectedProviderId,
    endpoint: draftConfig.endpoint ?? "",
    appKey: draftConfig.appKey ?? "",
    hasApiKeyReference: hasSttOnlineApiKeyReference(),
    hasTypedApiKey: false,
    keychainReady,
    connectionVerified: isSttConnectionVerified(draftConfig),
    lastProbeAvailable: null,
    lastProbeMessage: null,
  });
}
