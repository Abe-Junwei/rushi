import { useCallback, useEffect } from "react";
import {
  clampSttOnlineTimeoutSec,
  clearSttConnectionVerified,
  ensureSttOnlineApiKeyForSession,
  ensureSttOnlineApiSecretForSession,
  getSttOnlineProviderDefinition,
  normalizeExternalSttOnlineRuntimeConfig,
  persistExternalSttOnlineRuntimeConfig,
  persistSttOnlineApiSecretId,
  readExternalSttOnlineRuntimeConfigFromStorage,
  setSttOnlineApiKeyInMemory,
  setSttOnlineApiSecretInMemory,
} from "../services/stt/sttOnlineProviderContract";
import type { EnvOnlineSttFormFields } from "./envOnlineSttPanelDraft";
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
      const { olProviderId, olTimeoutSec } = fields;
      if (id !== olProviderId) {
        const prevDef = getSttOnlineProviderDefinition(olProviderId);
        const nextDef = getSttOnlineProviderDefinition(id);
        setSttOnlineApiKeyInMemory(null);
        setSttOnlineApiSecretInMemory(null);
        setOlApiKey("");
        setOlApiSecret("");
        setOlEndpoint("");
        onInvalidateProbe();
        clearSttConnectionVerified();
        setSavedApiKeyId(null);
        setSavedApiSecretId(null);
        persistSttOnlineApiSecretId(null, { clearApiSecretId: true });
        if (prevDef?.requiresPersistedAppKey || nextDef?.requiresPersistedAppKey) {
          setOlAppKey("");
        }
        if (id !== "iflytek-speed-asr") {
          setOlAccent("mandarin");
        }
        const def = nextDef;
        if (def) {
          setOlTimeoutSec(clampSttOnlineTimeoutSec(Math.round(def.defaultTimeoutMs / 1000)));
        }
        const n = normalizeExternalSttOnlineRuntimeConfig({
          enabled: true,
          selectedProviderId: id,
          timeoutMs: def ? def.defaultTimeoutMs : olTimeoutSec * 1000,
          ...(id === "iflytek-speed-asr" ? { accent: "mandarin" } : {}),
        });
        persistExternalSttOnlineRuntimeConfig(n, { clearApiKeyId: true, clearApiSecretId: true });
        onSttOnlineRuntimeChanged?.();
      }
      setOlProviderId(id);
    },
    [
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
