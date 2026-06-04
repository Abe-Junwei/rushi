import { buildOnlineSttEnvPresentation, type OnlineSttEnvTone } from "./onlineSttEnvStatus";
import {
  getSttOnlineApiKeyFromMemory,
  isSttConnectionVerified,
  normalizeExternalSttOnlineRuntimeConfig,
  readExternalSttOnlineRuntimeConfigFromStorage,
} from "./sttOnlineProviderContract";

/** 设置侧栏在线 STT 状态点（读持久化 + 会话密钥，不含表单草稿）。 */
export function readOnlineSttEnvNavTone(): OnlineSttEnvTone {
  const stored = readExternalSttOnlineRuntimeConfigFromStorage();
  const draftConfig = normalizeExternalSttOnlineRuntimeConfig({
    enabled: true,
    selectedProviderId: stored.selectedProviderId,
    endpoint: stored.endpoint ?? "",
    appKey: stored.appKey ?? "",
    timeoutMs: stored.timeoutMs,
  });
  const presentation = buildOnlineSttEnvPresentation({
    enabled: true,
    providerId: stored.selectedProviderId,
    endpoint: stored.endpoint ?? "",
    appKey: stored.appKey ?? "",
    hasApiKeyInSession: Boolean(getSttOnlineApiKeyFromMemory()?.trim()),
    connectionVerified: isSttConnectionVerified(draftConfig),
    lastProbeAvailable: null,
    lastProbeMessage: null,
  });
  return presentation.tone;
}
