import {
  clampSttOnlineTimeoutSec,
  normalizeExternalSttOnlineRuntimeConfig,
  readExternalSttOnlineRuntimeConfigFromStorage,
  sttOnlineProviderEndpointUserConfigurable,
} from "../services/stt/sttOnlineProviderContract";

export type EnvOnlineSttFormFields = {
  olProviderId: string;
  olEndpoint: string;
  olTimeoutSec: number;
  olAppKey: string;
  olApiKey: string;
  olApiSecret: string;
  olAccent: string;
  savedApiKeyId: string | null;
  savedApiSecretId: string | null;
};

/** 与导航/状态条同源：首帧从 localStorage 同步读入，避免 openai 默认值导致黄/灰不一致。 */
export function readInitialOnlineSttFormFields(): EnvOnlineSttFormFields {
  const c = readExternalSttOnlineRuntimeConfigFromStorage();
  return {
    olProviderId: c.selectedProviderId,
    olEndpoint: c.endpoint ?? "",
    olTimeoutSec: clampSttOnlineTimeoutSec(Math.round(c.timeoutMs / 1000)),
    olAppKey: c.appKey ?? "",
    olApiKey: "",
    olApiSecret: "",
    olAccent: c.accent ?? "mandarin",
    savedApiKeyId: c.apiKeyId ?? null,
    savedApiSecretId: c.apiSecretId ?? null,
  };
}

export function buildOnlineSttDraftRuntimeConfig(fields: EnvOnlineSttFormFields) {
  const { olProviderId, olEndpoint, olTimeoutSec, olAppKey, olAccent } = fields;
  return normalizeExternalSttOnlineRuntimeConfig({
    enabled: true,
    selectedProviderId: olProviderId,
    ...(sttOnlineProviderEndpointUserConfigurable(olProviderId)
      ? { endpoint: olEndpoint.trim() || undefined }
      : {}),
    appKey: olAppKey.trim() || undefined,
    accent: olAccent.trim() || undefined,
    timeoutMs: olTimeoutSec * 1000,
  });
}
