import { useCallback, useEffect, useMemo, useState } from "react";
import { formatSttProbeFailureMessage } from "../services/stt/sttProbeUserMessage";
import { useSttKeychainReady } from "../hooks/useSttKeychainReady";
import { toast } from "../services/ui/toast";
import { waitMinVisibleBusy } from "../services/ui/minVisibleBusy";
import { buildOnlineSttEnvPresentation } from "../services/stt/onlineSttEnvStatus";
import {
  clampSttOnlineTimeoutSec,
  clearSttConnectionVerified,
  DEFAULT_STT_API_KEY_ID,
  ensureSttOnlineApiKeyForSession,
  getSttOnlineProviderDefinition,
  glossaryBiasSummaryForProviderId,
  hasSttOnlineApiKeyReference,
  isSttConnectionVerified,
  markSttConnectionVerified,
  normalizeExternalSttOnlineRuntimeConfig,
  normalizeSttApiKeyId,
  persistExternalSttOnlineRuntimeConfig,
  probeExternalSttOnlineHealth,
  readExternalSttOnlineRuntimeConfigFromStorage,
  setSttOnlineApiKeyInMemory,
  STT_CONNECTION_VERIFIED_EVENT,
  sttOnlineProviderEndpointUserConfigurable,
} from "../services/stt/sttOnlineProviderContract";
import { sttDeleteApiKey, sttSaveApiKey } from "../tauri/sttApi";

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
  const [savedApiKeyId, setSavedApiKeyId] = useState<string | null>(null);
  const [olProbeBusy, setOlProbeBusy] = useState(false);
  const [olSaveBusy, setOlSaveBusy] = useState(false);
  const [lastProbeAvailable, setLastProbeAvailable] = useState<boolean | null>(null);
  const [connectionVerifiedRevision, setConnectionVerifiedRevision] = useState(0);
  const [keychainRefreshSeq, setKeychainRefreshSeq] = useState(0);

  const bumpKeychainCheck = useCallback(() => {
    setKeychainRefreshSeq((n) => n + 1);
  }, []);

  useEffect(() => {
    const onConnectionVerifiedChange = () => {
      setConnectionVerifiedRevision((n) => n + 1);
    };
    window.addEventListener(STT_CONNECTION_VERIFIED_EVENT, onConnectionVerifiedChange);
    return () => {
      window.removeEventListener(STT_CONNECTION_VERIFIED_EVENT, onConnectionVerifiedChange);
    };
  }, []);

  useEffect(() => {
    const c = readExternalSttOnlineRuntimeConfigFromStorage();
    setOlProviderId(c.selectedProviderId);
    setOlEndpoint(c.endpoint ?? "");
    setOlAppKey(c.appKey ?? "");
    setOlTimeoutSec(clampSttOnlineTimeoutSec(Math.round(c.timeoutMs / 1000)));
    setSavedApiKeyId(c.apiKeyId ?? null);
    void ensureSttOnlineApiKeyForSession().finally(() => {
      bumpKeychainCheck();
    });
  }, [bumpKeychainCheck]);

  const { keychainReady, checking: keychainChecking } = useSttKeychainReady(keychainRefreshSeq);

  const olDef = getSttOnlineProviderDefinition(olProviderId) ?? null;

  const draftConfig = useMemo(
    () =>
      normalizeExternalSttOnlineRuntimeConfig({
        enabled: true,
        selectedProviderId: olProviderId,
        ...(sttOnlineProviderEndpointUserConfigurable(olProviderId)
          ? { endpoint: olEndpoint.trim() || undefined }
          : {}),
        appKey: olAppKey.trim() || undefined,
        apiKeyId: savedApiKeyId ?? undefined,
        timeoutMs: olTimeoutSec * 1000,
      }),
    [olAppKey, olEndpoint, olProviderId, olTimeoutSec, savedApiKeyId],
  );

  const connectionVerified = isSttConnectionVerified(draftConfig);

  const presentation = useMemo(
    () =>
      buildOnlineSttEnvPresentation({
        enabled: true,
        providerId: olProviderId,
        endpoint: olEndpoint,
        appKey: olAppKey,
        hasApiKeyReference: hasSttOnlineApiKeyReference(),
        hasTypedApiKey: olApiKey.trim().length > 0,
        keychainReady: keychainChecking ? null : keychainReady,
        connectionVerified,
        lastProbeAvailable,
        lastProbeMessage: null,
      }),
    [
      olApiKey,
      olEndpoint,
      olProviderId,
      olAppKey,
      connectionVerified,
      connectionVerifiedRevision,
      keychainChecking,
      keychainReady,
      lastProbeAvailable,
    ],
  );

  const onlineGlossarySummary = useMemo(
    () => glossaryBiasSummaryForProviderId(olProviderId),
    [olProviderId],
  );

  const buildDraftRuntimeConfig = useCallback(() => {
    return normalizeExternalSttOnlineRuntimeConfig({
      enabled: true,
      selectedProviderId: olProviderId,
      ...(sttOnlineProviderEndpointUserConfigurable(olProviderId)
        ? { endpoint: olEndpoint.trim() || undefined }
        : {}),
      appKey: olAppKey.trim() || undefined,
      timeoutMs: olTimeoutSec * 1000,
    });
  }, [olAppKey, olEndpoint, olProviderId, olTimeoutSec]);

  const saveOnlineStt = useCallback(async () => {
    setLastProbeAvailable(null);
    setOlSaveBusy(true);
    try {
      const typedApiKey = olApiKey.trim();
      let nextApiKeyId = normalizeSttApiKeyId(savedApiKeyId ?? readExternalSttOnlineRuntimeConfigFromStorage().apiKeyId);
      if (typedApiKey) {
        nextApiKeyId = await sttSaveApiKey({
          apiKeyId: DEFAULT_STT_API_KEY_ID,
          apiKey: typedApiKey,
        });
        clearSttConnectionVerified();
      }
      if (!nextApiKeyId) {
        throw new Error("请先填写 API Key，再点击保存在线配置。");
      }
      const n = buildDraftRuntimeConfig();
      persistExternalSttOnlineRuntimeConfig({ ...n, apiKeyId: nextApiKeyId });
      setSavedApiKeyId(nextApiKeyId);
      setSttOnlineApiKeyInMemory(null);
      bumpKeychainCheck();
      onSttOnlineRuntimeChanged?.();
      if (typedApiKey) {
        setOlApiKey("");
        toast.success("API Key 已保存，请重新探测连接。");
      } else {
        toast.success("已保存，沿用已存 Key。");
      }
    } catch (e) {
      toast.errorFromUnknown(e);
    } finally {
      setOlSaveBusy(false);
    }
  }, [
    bumpKeychainCheck,
    buildDraftRuntimeConfig,
    olApiKey,
    onSttOnlineRuntimeChanged,
    savedApiKeyId,
  ]);

  const clearSavedApiKey = useCallback(async () => {
    if (!savedApiKeyId && !readExternalSttOnlineRuntimeConfigFromStorage().apiKeyId) return;
    setOlSaveBusy(true);
    try {
      const rawId = savedApiKeyId ?? readExternalSttOnlineRuntimeConfigFromStorage().apiKeyId;
      const ids = new Set<string>([DEFAULT_STT_API_KEY_ID]);
      if (rawId?.trim()) ids.add(rawId.trim());
      for (const id of ids) {
        await sttDeleteApiKey({ apiKeyId: id }).catch(() => {
          /* ignore missing legacy entries */
        });
      }
      const n = buildDraftRuntimeConfig();
      persistExternalSttOnlineRuntimeConfig(n, { clearApiKeyId: true });
      setSavedApiKeyId(null);
      setOlApiKey("");
      setSttOnlineApiKeyInMemory(null);
      setLastProbeAvailable(null);
      bumpKeychainCheck();
      onSttOnlineRuntimeChanged?.();
      toast.success("已清除本地保存的 API Key。");
    } catch (e) {
      toast.errorFromUnknown(e);
    } finally {
      setOlSaveBusy(false);
    }
  }, [buildDraftRuntimeConfig, bumpKeychainCheck, onSttOnlineRuntimeChanged, savedApiKeyId]);

  const probeOnlineStt = useCallback(async () => {
    const startedAt = Date.now();
    setOlProbeBusy(true);
    try {
      const typedApiKey = olApiKey.trim();
      let nextApiKeyId = normalizeSttApiKeyId(savedApiKeyId ?? readExternalSttOnlineRuntimeConfigFromStorage().apiKeyId);
      if (typedApiKey) {
        nextApiKeyId = await sttSaveApiKey({
          apiKeyId: DEFAULT_STT_API_KEY_ID,
          apiKey: typedApiKey,
        });
        setSavedApiKeyId(nextApiKeyId ?? DEFAULT_STT_API_KEY_ID);
        setOlApiKey("");
      }
      if (!nextApiKeyId && !hasSttOnlineApiKeyReference()) {
        throw new Error("请先填写 API Key，再点击探测连接。");
      }
      if (typedApiKey) {
        setSttOnlineApiKeyInMemory(typedApiKey);
      } else {
        await ensureSttOnlineApiKeyForSession();
      }
      const cfg = buildDraftRuntimeConfig();
      const r = await probeExternalSttOnlineHealth({ runtimeConfig: cfg });
      setLastProbeAvailable(r.available);
      if (r.available) {
        persistExternalSttOnlineRuntimeConfig({ ...cfg, apiKeyId: nextApiKeyId ?? savedApiKeyId ?? DEFAULT_STT_API_KEY_ID });
        markSttConnectionVerified({ ...cfg, apiKeyId: nextApiKeyId ?? savedApiKeyId ?? DEFAULT_STT_API_KEY_ID });
        setSttOnlineApiKeyInMemory(null);
        bumpKeychainCheck();
        toast.success(`在线 STT 可达（约 ${r.latencyMs ?? "?"} ms）`);
      } else {
        toast.error(formatSttProbeFailureMessage(r));
      }
      onSttOnlineRuntimeChanged?.();
    } catch (e) {
      setLastProbeAvailable(false);
      toast.errorFromUnknown(e);
    } finally {
      await waitMinVisibleBusy(startedAt);
      setOlProbeBusy(false);
    }
  }, [
    bumpKeychainCheck,
    buildDraftRuntimeConfig,
    olApiKey,
    onSttOnlineRuntimeChanged,
    savedApiKeyId,
  ]);

  const onProviderChange = useCallback(
    (id: string) => {
      if (id !== olProviderId) {
        setSttOnlineApiKeyInMemory(null);
        setOlApiKey("");
        setOlEndpoint("");
        setLastProbeAvailable(null);
        clearSttConnectionVerified();
        const def = getSttOnlineProviderDefinition(id);
        if (def) {
          setOlTimeoutSec(clampSttOnlineTimeoutSec(Math.round(def.defaultTimeoutMs / 1000)));
        }
      }
      setOlProviderId(id);
    },
    [olProviderId],
  );

  const formBusy = busy || olProbeBusy || olSaveBusy;

  return {
    formBusy,
    olProbeBusy,
    olProviderId,
    olDef,
    olEndpoint,
    olTimeoutSec,
    olAppKey,
    olApiKey,
    savedApiKeyId,
    presentation,
    onlineGlossarySummary,
    keychainChecking,
    keychainReady,
    setOlEndpoint,
    setOlTimeoutSec: (v: number) => setOlTimeoutSec(clampSttOnlineTimeoutSec(v)),
    setOlAppKey,
    setOlApiKey,
    onProviderChange,
    clearSavedApiKey,
    saveOnlineStt,
    probeOnlineStt,
  };
}
