import {
  normalizeExternalSttOnlineRuntimeConfig,
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
