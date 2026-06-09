import { localSecretStoreReferenceMessage } from "../../config/environmentNavCopy";
import { normalizeSttApiKeyId } from "./sttOnlineProviderContract/sttApiKeyIds";

export function sttKeychainReferenceMessage(
  apiKeyId: string | null,
  keychainPresent: boolean | null,
): string {
  return localSecretStoreReferenceMessage(normalizeSttApiKeyId(apiKeyId) ?? null, keychainPresent);
}
