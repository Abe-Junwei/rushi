import { useCallback, useMemo, useState } from "react";
import { useSttKeychainReady } from "../hooks/useSttKeychainReady";
import { buildOnlineSttEnvPresentation } from "../services/stt/onlineSttEnvStatus";
import { buildOnlineSttEnvPresentationInputFromStorage } from "../services/stt/onlineSttEnvPresentationInput";
import {
  getSttOnlineProviderDefinition,
  glossaryBiasSummaryForProviderId,
  clampSttOnlineTimeoutSec,
} from "../services/stt/sttOnlineProviderContract";
import {
  readInitialOnlineSttFormFields,
  useEnvOnlineSttPanelPersistence,
} from "./useEnvOnlineSttPanelPersistence";
import { useEnvOnlineSttPanelProbe } from "./useEnvOnlineSttPanelProbe";

export type UseEnvOnlineSttPanelArgs = {
  busy: boolean;
  onSttOnlineRuntimeChanged?: () => void;
};

export function useEnvOnlineSttPanel({ busy, onSttOnlineRuntimeChanged }: UseEnvOnlineSttPanelArgs) {
  const [olProviderId, setOlProviderId] = useState(
    () => readInitialOnlineSttFormFields().olProviderId,
  );
  const [olEndpoint, setOlEndpoint] = useState(() => readInitialOnlineSttFormFields().olEndpoint);
  const [olTimeoutSec, setOlTimeoutSec] = useState(
    () => readInitialOnlineSttFormFields().olTimeoutSec,
  );
  const [olAppKey, setOlAppKey] = useState(() => readInitialOnlineSttFormFields().olAppKey);
  const [olApiKey, setOlApiKey] = useState(() => readInitialOnlineSttFormFields().olApiKey);
  const [olApiSecret, setOlApiSecret] = useState(
    () => readInitialOnlineSttFormFields().olApiSecret,
  );
  const [olAccent, setOlAccent] = useState(() => readInitialOnlineSttFormFields().olAccent);
  const [savedApiKeyId, setSavedApiKeyId] = useState<string | null>(
    () => readInitialOnlineSttFormFields().savedApiKeyId,
  );
  const [savedApiSecretId, setSavedApiSecretId] = useState<string | null>(
    () => readInitialOnlineSttFormFields().savedApiSecretId,
  );
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

  const presentation = useMemo(
    () =>
      buildOnlineSttEnvPresentation(
        buildOnlineSttEnvPresentationInputFromStorage({
          hasTypedApiKey: olApiKey.trim().length > 0,
          keychainReady: keychainChecking ? null : keychainReady,
          lastProbeAvailable: probeHook.lastProbeAvailable,
          lastProbeMessage: null,
        }),
      ),
    [
      olApiKey,
      keychainChecking,
      keychainReady,
      probeHook.lastProbeAvailable,
      keychainRefreshSeq,
    ],
  );

  const onlineGlossarySummary = useMemo(
    () => glossaryBiasSummaryForProviderId(olProviderId),
    [olProviderId],
  );

  const formBusy = busy || probeHook.probeBusy || persistence.saveBusy;

  const saveOnlineStt = useCallback(async () => {
    const ok = await persistence.saveOnlineStt();
    if (ok) await probeHook.probeOnlineStt({ preferPersistedCredentials: true });
  }, [persistence.saveOnlineStt, probeHook.probeOnlineStt]);

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
    saveOnlineStt,
    probeOnlineStt: probeHook.probeOnlineStt,
  };
}
