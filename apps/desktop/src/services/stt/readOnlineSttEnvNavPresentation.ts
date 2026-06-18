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

function readOnlineSttEnvNavPresentation(): OnlineSttEnvPresentation {
  const stored = readExternalSttOnlineRuntimeConfigFromStorage();
  const draftConfig = normalizeExternalSttOnlineRuntimeConfig({
    ...stored,
    enabled: true,
  });
  return buildOnlineSttEnvPresentation({
    enabled: true,
    providerId: draftConfig.selectedProviderId,
    endpoint: draftConfig.endpoint ?? "",
    appKey: draftConfig.appKey ?? "",
    hasApiKeyReference: hasSttOnlineApiKeyReference(),
    hasTypedApiKey: false,
    keychainReady: null,
    connectionVerified: isSttConnectionVerified(draftConfig),
    lastProbeAvailable: null,
    lastProbeMessage: null,
  });
}
