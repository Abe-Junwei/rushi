import type { BuildOnlineSttEnvPresentationInput } from "./onlineSttEnvStatus";
import {
  hasSttOnlineApiKeyReference,
  isSttConnectionVerified,
  normalizeExternalSttOnlineRuntimeConfig,
  readExternalSttOnlineRuntimeConfigFromStorage,
} from "./sttOnlineProviderContract";

/** 在线 STT 状态条/导航点共用输入：读持久化配置，不含表单草稿与探测结果。 */
export function buildOnlineSttEnvPresentationInputFromStorage(
  overrides: Partial<BuildOnlineSttEnvPresentationInput> = {},
): BuildOnlineSttEnvPresentationInput {
  const stored = readExternalSttOnlineRuntimeConfigFromStorage();
  const draftConfig = normalizeExternalSttOnlineRuntimeConfig({
    ...stored,
    enabled: true,
  });
  return {
    enabled: stored.enabled,
    providerId: draftConfig.selectedProviderId,
    endpoint: draftConfig.endpoint ?? "",
    appKey: draftConfig.appKey ?? "",
    hasApiKeyReference: hasSttOnlineApiKeyReference(),
    hasTypedApiKey: false,
    keychainReady: null,
    connectionVerified: isSttConnectionVerified(draftConfig),
    lastProbeAvailable: null,
    lastProbeMessage: null,
    ...overrides,
  };
}
