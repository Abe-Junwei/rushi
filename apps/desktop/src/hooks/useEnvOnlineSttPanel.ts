import { useCallback, useMemo, useState } from "react";
import { useSttKeychainReady } from "../hooks/useSttKeychainReady";
import { buildOnlineSttEnvPresentation } from "../services/stt/onlineSttEnvStatus";
import {
  clampSttOnlineTimeoutSec,
  getSttOnlineProviderDefinition,
  glossaryBiasSummaryForProviderId,
  hasSttOnlineApiKeyReference,
  isSttConnectionVerified,
  normalizeExternalSttOnlineRuntimeConfig,
  readExternalSttOnlineRuntimeConfigFromStorage,
} from "../services/stt/sttOnlineProviderContract";
import { buildOnlineSttDraftRuntimeConfig, useEnvOnlineSttPanelPersistence } from "./useEnvOnlineSttPanelPersistence";
import { useEnvOnlineSttPanelProbe } from "./useEnvOnlineSttPanelProbe";

export type UseEnvOnlineSttPanelArgs = {
  busy: boolean;
  onSttOnlineRuntimeChanged?: () => void;
};

export function useEnvOnlineSttPanel({ busy, onSttOnlineRuntimeChanged }: UseEnvOnlineSttPanelArgs) {
  const [olProviderId, setOlProviderId] = useState("openai");
  const [olEndpoint, setOlEndpoint] = useState("");
  const [olTimeoutSec, setOlTimeoutSec] = useState(30);
  const [olAppKey, setOlAppKey] = useState("");
  const [olApiKey, setOlApiKey] = useState("");
  const [olApiSecret, setOlApiSecret] = useState("");
  const [olAccent, setOlAccent] = useState("mandarin");
  const [savedApiKeyId, setSavedApiKeyId] = useState<string | null>(null);
  const [savedApiSecretId, setSavedApiSecretId] = useState<string | null>(null);
  const [keychainRefreshSeq, setKeychainRefreshSeq] = useState(0);

  const bumpKeychainCheck = useCallback(() => {
    setKeychainRefreshSeq((n) => n + 1);
  }, []);

  const fields = useMemo(
    () => ({
      olProviderId,
      olEndpoint,
      olTimeoutSec,
      olAppKey,
      olApiKey,
      olApiSecret,
      olAccent,
      savedApiKeyId,
      savedApiSecretId,
    }),
    [
      olAccent,
      olApiKey,
      olApiSecret,
      olAppKey,
      olEndpoint,
      olProviderId,
      olTimeoutSec,
      savedApiKeyId,
      savedApiSecretId,
    ],
  );

  const probeHook = useEnvOnlineSttPanelProbe({
    fields,
    setOlApiKey,
    setOlApiSecret,
    setSavedApiKeyId,
    setSavedApiSecretId,
    bumpKeychainCheck,
    onSttOnlineRuntimeChanged,
  });

  const persistence = useEnvOnlineSttPanelPersistence({
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
    onInvalidateProbe: probeHook.invalidateProbe,
  });

  const { keychainReady, checking: keychainChecking } = useSttKeychainReady(keychainRefreshSeq);

  const olDef = getSttOnlineProviderDefinition(olProviderId) ?? null;

  const draftConfig = useMemo(
    () =>
      normalizeExternalSttOnlineRuntimeConfig({
        ...buildOnlineSttDraftRuntimeConfig(fields),
        apiKeyId: savedApiKeyId ?? undefined,
        apiSecretId: savedApiSecretId ?? undefined,
      }),
    [fields, savedApiKeyId, savedApiSecretId],
  );

  const connectionVerified = isSttConnectionVerified(draftConfig);

  const storedRuntime = useMemo(() => readExternalSttOnlineRuntimeConfigFromStorage(), [keychainRefreshSeq]);

  const presentation = useMemo(
    () =>
      buildOnlineSttEnvPresentation({
        enabled: storedRuntime.enabled,
        providerId: olProviderId,
        endpoint: olEndpoint,
        appKey: olAppKey,
        hasApiKeyReference: hasSttOnlineApiKeyReference(),
        hasTypedApiKey: olApiKey.trim().length > 0,
        keychainReady: keychainChecking ? null : keychainReady,
        connectionVerified,
        lastProbeAvailable: probeHook.lastProbeAvailable,
        lastProbeMessage: null,
      }),
    [
      olApiKey,
      olEndpoint,
      olProviderId,
      olAppKey,
      connectionVerified,
      keychainChecking,
      keychainReady,
      probeHook.lastProbeAvailable,
      storedRuntime.enabled,
    ],
  );

  const onlineGlossarySummary = useMemo(
    () => glossaryBiasSummaryForProviderId(olProviderId),
    [olProviderId],
  );

  const formBusy = busy || probeHook.probeBusy || persistence.saveBusy;

  return {
    formBusy,
    olProbeBusy: probeHook.probeBusy,
    olProviderId,
    olDef,
    olEndpoint,
    olTimeoutSec,
    olAppKey,
    olApiKey,
    olApiSecret,
    olAccent,
    savedApiKeyId,
    savedApiSecretId,
    presentation,
    onlineGlossarySummary,
    keychainChecking,
    keychainReady,
    setOlEndpoint,
    setOlTimeoutSec: (v: number) => setOlTimeoutSec(clampSttOnlineTimeoutSec(v)),
    setOlAppKey,
    setOlApiKey,
    setOlApiSecret,
    setOlAccent,
    onProviderChange: persistence.onProviderChange,
    clearSavedApiKey: persistence.clearSavedApiKey,
    saveOnlineStt: persistence.saveOnlineStt,
    probeOnlineStt: probeHook.probeOnlineStt,
  };
}
