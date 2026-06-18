import { useCallback, useEffect } from "react";
import {
  clampSttOnlineTimeoutSec,
  ensureSttOnlineApiKeyForSession,
  ensureSttOnlineApiSecretForSession,
  normalizeExternalSttOnlineRuntimeConfig,
  readExternalSttOnlineRuntimeConfigFromStorage,
  setSttOnlineApiKeyInMemory,
  setSttOnlineApiSecretInMemory,
  switchSttOnlineProviderActive,
} from "../services/stt/sttOnlineProviderContract";
import type { EnvOnlineSttFormFields } from "./envOnlineSttPanelDraft";
import { buildOnlineSttDraftRuntimeConfig } from "./envOnlineSttPanelDraft";
import { useEnvOnlineSttPanelCredentialActions } from "./useEnvOnlineSttPanelCredentialActions";

export type { EnvOnlineSttFormFields } from "./envOnlineSttPanelDraft";
export { buildOnlineSttDraftRuntimeConfig } from "./envOnlineSttPanelDraft";

export type UseEnvOnlineSttPanelPersistenceArgs = {
  fields: EnvOnlineSttFormFields;
  setOlProviderId: (v: string) => void;
  setOlEndpoint: (v: string) => void;
  setOlTimeoutSec: (v: number) => void;
  setOlAppKey: (v: string) => void;
  setOlApiKey: (v: string) => void;
  setOlApiSecret: (v: string) => void;
  setOlAccent: (v: string) => void;
  setSavedApiKeyId: (v: string | null) => void;
  setSavedApiSecretId: (v: string | null) => void;
  bumpKeychainCheck: () => void;
  onSttOnlineRuntimeChanged?: () => void;
  onInvalidateProbe: () => void;
};

export function useEnvOnlineSttPanelPersistence(args: UseEnvOnlineSttPanelPersistenceArgs) {
  const {
    fields,
    setOlProviderId,
    setOlEndpoint,
    setOlTimeoutSec,
    setOlAppKey,
    setOlApiKey,
    setOlApiSecret,
    setOlAccent,
    setSavedApiKeyId,
    setSavedApiSecretId,
    bumpKeychainCheck,
    onSttOnlineRuntimeChanged,
    onInvalidateProbe,
  } = args;

  useEffect(() => {
    const c = readExternalSttOnlineRuntimeConfigFromStorage();
    setOlProviderId(c.selectedProviderId);
    setOlEndpoint(c.endpoint ?? "");
    setOlAppKey(c.appKey ?? "");
    setOlAccent(c.accent ?? "mandarin");
    setOlTimeoutSec(clampSttOnlineTimeoutSec(Math.round(c.timeoutMs / 1000)));
    setSavedApiKeyId(c.apiKeyId ?? null);
    setSavedApiSecretId(c.apiSecretId ?? null);
    void Promise.all([ensureSttOnlineApiKeyForSession(), ensureSttOnlineApiSecretForSession()]).finally(
      () => {
        bumpKeychainCheck();
      },
    );
  }, [
    bumpKeychainCheck,
    setOlAccent,
    setOlAppKey,
    setOlEndpoint,
    setOlProviderId,
    setOlTimeoutSec,
    setSavedApiKeyId,
    setSavedApiSecretId,
  ]);

  const credentialActions = useEnvOnlineSttPanelCredentialActions({
    fields,
    setOlApiKey,
    setOlApiSecret,
    setSavedApiKeyId,
    setSavedApiSecretId,
    bumpKeychainCheck,
    onSttOnlineRuntimeChanged,
    onInvalidateProbe,
  });

  const onProviderChange = useCallback(
    (id: string) => {
      const { olProviderId } = fields;
      if (id !== olProviderId) {
        setSttOnlineApiKeyInMemory(null);
        setSttOnlineApiSecretInMemory(null);
        setOlApiKey("");
        setOlApiSecret("");
        onInvalidateProbe();
        const outgoingDraft = normalizeExternalSttOnlineRuntimeConfig({
          ...buildOnlineSttDraftRuntimeConfig(fields),
          apiKeyId: fields.savedApiKeyId ?? undefined,
          apiSecretId: fields.savedApiSecretId ?? undefined,
        });
        const incoming = switchSttOnlineProviderActive(olProviderId, id, outgoingDraft);
        setOlProviderId(incoming.selectedProviderId);
        setOlEndpoint(incoming.endpoint ?? "");
        setOlAppKey(incoming.appKey ?? "");
        setOlAccent(incoming.accent ?? "mandarin");
        setOlTimeoutSec(clampSttOnlineTimeoutSec(Math.round(incoming.timeoutMs / 1000)));
        setSavedApiKeyId(incoming.apiKeyId ?? null);
        setSavedApiSecretId(incoming.apiSecretId ?? null);
        bumpKeychainCheck();
        onSttOnlineRuntimeChanged?.();
      } else {
        setOlProviderId(id);
      }
    },
    [
      bumpKeychainCheck,
      fields,
      onInvalidateProbe,
      onSttOnlineRuntimeChanged,
      setOlAccent,
      setOlApiKey,
      setOlApiSecret,
      setOlAppKey,
      setOlEndpoint,
      setOlProviderId,
      setOlTimeoutSec,
      setSavedApiKeyId,
      setSavedApiSecretId,
    ],
  );

  return {
    saveBusy: credentialActions.saveBusy,
    saveOnlineStt: credentialActions.saveOnlineStt,
    clearSavedApiKey: credentialActions.clearSavedApiKey,
    onProviderChange,
  };
}
