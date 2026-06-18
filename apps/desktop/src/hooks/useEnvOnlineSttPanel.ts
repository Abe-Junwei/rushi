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
  ensureSttOnlineApiSecretForSession,
  getSttOnlineProviderDefinition,
  glossaryBiasSummaryForProviderId,
  hasSttOnlineApiKeyReference,
  hasSttOnlineApiSecretReference,
  IFLYTEK_STT_API_KEY_ID,
  IFLYTEK_STT_API_SECRET_ID,
  isSttConnectionVerified,
  markSttConnectionVerified,
  normalizeExternalSttOnlineRuntimeConfig,
  normalizeSttApiKeyId,
  persistExternalSttOnlineRuntimeConfig,
  persistSttOnlineApiSecretId,
  probeExternalSttOnlineHealth,
  readExternalSttOnlineRuntimeConfigFromStorage,
  readSttOnlineApiSecretIdFromStorage,
  resolveSttApiKeyIdForProvider,
  resolveSttApiSecretIdForProvider,
  setSttOnlineApiKeyInMemory,
  setSttOnlineApiSecretInMemory,
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
  const [olApiSecret, setOlApiSecret] = useState("");
  const [olAccent, setOlAccent] = useState("mandarin");
  const [savedApiKeyId, setSavedApiKeyId] = useState<string | null>(null);
  const [savedApiSecretId, setSavedApiSecretId] = useState<string | null>(null);
  const [olProbeBusy, setOlProbeBusy] = useState(false);
  const [olSaveBusy, setOlSaveBusy] = useState(false);
  const [lastProbeAvailable, setLastProbeAvailable] = useState<boolean | null>(null);
  const [keychainRefreshSeq, setKeychainRefreshSeq] = useState(0);

  const bumpKeychainCheck = useCallback(() => {
    setKeychainRefreshSeq((n) => n + 1);
  }, []);

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
        accent: olAccent.trim() || undefined,
        apiKeyId: savedApiKeyId ?? undefined,
        apiSecretId: savedApiSecretId ?? undefined,
        timeoutMs: olTimeoutSec * 1000,
      }),
    [olAppKey, olAccent, olEndpoint, olProviderId, olTimeoutSec, savedApiKeyId, savedApiSecretId],
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
      accent: olAccent.trim() || undefined,
      timeoutMs: olTimeoutSec * 1000,
    });
  }, [olAccent, olAppKey, olEndpoint, olProviderId, olTimeoutSec]);

  const saveOnlineStt = useCallback(async () => {
    setLastProbeAvailable(null);
    setOlSaveBusy(true);
    try {
      const typedApiKey = olApiKey.trim();
      const typedApiSecret = olApiSecret.trim();
      const providerDef = getSttOnlineProviderDefinition(olProviderId);
      const providerApiKeyId = resolveSttApiKeyIdForProvider(olProviderId);
      const providerApiSecretId = resolveSttApiSecretIdForProvider(olProviderId);
      let nextApiKeyId = normalizeSttApiKeyId(savedApiKeyId ?? readExternalSttOnlineRuntimeConfigFromStorage().apiKeyId);
      let nextApiSecretId = normalizeSttApiKeyId(
        savedApiSecretId ?? readSttOnlineApiSecretIdFromStorage(),
      );
      if (typedApiKey) {
        nextApiKeyId = await sttSaveApiKey({
          apiKeyId: providerApiKeyId,
          apiKey: typedApiKey,
        });
        clearSttConnectionVerified();
      }
      if (providerDef?.requiresApiSecret && typedApiSecret && providerApiSecretId) {
        nextApiSecretId = await sttSaveApiKey({
          apiKeyId: providerApiSecretId,
          apiKey: typedApiSecret,
        });
        clearSttConnectionVerified();
      }
      const apiKeyLabel = providerDef?.credentialFieldLabel ?? "API Key";
      if (!nextApiKeyId) {
        throw new Error(`请先填写 ${apiKeyLabel}，再点击保存在线配置。`);
      }
      if (providerDef?.requiresApiSecret && !nextApiSecretId && !hasSttOnlineApiSecretReference()) {
        throw new Error("请先填写 APISecret，再点击保存在线配置。");
      }
      const n = buildDraftRuntimeConfig();
      persistExternalSttOnlineRuntimeConfig({
        ...n,
        apiKeyId: nextApiKeyId,
        ...(nextApiSecretId ? { apiSecretId: nextApiSecretId } : {}),
      });
      setSavedApiKeyId(nextApiKeyId);
      if (nextApiSecretId) {
        persistSttOnlineApiSecretId(nextApiSecretId);
        setSavedApiSecretId(nextApiSecretId);
      }
      setSttOnlineApiKeyInMemory(null);
      if (typedApiSecret) {
        setSttOnlineApiSecretInMemory(null);
        setOlApiSecret("");
      }
      bumpKeychainCheck();
      onSttOnlineRuntimeChanged?.();
      if (typedApiKey) {
        setOlApiKey("");
        toast.success(`${apiKeyLabel} 已保存，请重新探测连接。`);
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
    olApiSecret,
    olProviderId,
    onSttOnlineRuntimeChanged,
    savedApiKeyId,
    savedApiSecretId,
  ]);

  const clearSavedApiKey = useCallback(async () => {
    const stored = readExternalSttOnlineRuntimeConfigFromStorage();
    if (!savedApiKeyId && !stored.apiKeyId && !savedApiSecretId && !stored.apiSecretId) return;
    setOlSaveBusy(true);
    try {
      const rawId = savedApiKeyId ?? stored.apiKeyId;
      const rawSecretId = savedApiSecretId ?? stored.apiSecretId;
      const ids = new Set<string>([
        DEFAULT_STT_API_KEY_ID,
        IFLYTEK_STT_API_KEY_ID,
        IFLYTEK_STT_API_SECRET_ID,
        resolveSttApiKeyIdForProvider(olProviderId),
      ]);
      const secretSlot = resolveSttApiSecretIdForProvider(olProviderId);
      if (secretSlot) ids.add(secretSlot);
      if (rawId?.trim()) ids.add(rawId.trim());
      if (rawSecretId?.trim()) ids.add(rawSecretId.trim());
      for (const id of ids) {
        await sttDeleteApiKey({ apiKeyId: id }).catch(() => {
          /* ignore missing legacy entries */
        });
      }
      const n = buildDraftRuntimeConfig();
      persistExternalSttOnlineRuntimeConfig(n, { clearApiKeyId: true, clearApiSecretId: true });
      persistSttOnlineApiSecretId(null, { clearApiSecretId: true });
      setSavedApiKeyId(null);
      setSavedApiSecretId(null);
      setOlApiKey("");
      setOlApiSecret("");
      setSttOnlineApiKeyInMemory(null);
      setSttOnlineApiSecretInMemory(null);
      clearSttConnectionVerified();
      setLastProbeAvailable(null);
      bumpKeychainCheck();
      onSttOnlineRuntimeChanged?.();
      toast.success("已清除本地保存的密钥。");
    } catch (e) {
      toast.errorFromUnknown(e);
    } finally {
      setOlSaveBusy(false);
    }
  }, [
    buildDraftRuntimeConfig,
    bumpKeychainCheck,
    olProviderId,
    onSttOnlineRuntimeChanged,
    savedApiKeyId,
    savedApiSecretId,
  ]);

  const probeOnlineStt = useCallback(async () => {
    const startedAt = Date.now();
    setOlProbeBusy(true);
    try {
      const typedApiKey = olApiKey.trim();
      const typedApiSecret = olApiSecret.trim();
      const providerDef = getSttOnlineProviderDefinition(olProviderId);
      const providerApiKeyId = resolveSttApiKeyIdForProvider(olProviderId);
      const providerApiSecretId = resolveSttApiSecretIdForProvider(olProviderId);
      const apiKeyLabel = providerDef?.credentialFieldLabel ?? "API Key";
      let nextApiKeyId = normalizeSttApiKeyId(savedApiKeyId ?? readExternalSttOnlineRuntimeConfigFromStorage().apiKeyId);
      let nextApiSecretId = normalizeSttApiKeyId(
        savedApiSecretId ?? readSttOnlineApiSecretIdFromStorage(),
      );
      if (typedApiKey) {
        nextApiKeyId = await sttSaveApiKey({
          apiKeyId: providerApiKeyId,
          apiKey: typedApiKey,
        });
        setSavedApiKeyId(nextApiKeyId ?? providerApiKeyId);
        setOlApiKey("");
      }
      if (!nextApiKeyId && !hasSttOnlineApiKeyReference()) {
        throw new Error(`请先填写 ${apiKeyLabel}，再点击探测连接。`);
      }
      if (providerDef?.requiresApiSecret) {
        if (typedApiSecret && providerApiSecretId) {
          nextApiSecretId = await sttSaveApiKey({
            apiKeyId: providerApiSecretId,
            apiKey: typedApiSecret,
          });
          persistSttOnlineApiSecretId(nextApiSecretId);
          setSavedApiSecretId(nextApiSecretId ?? providerApiSecretId);
          setOlApiSecret("");
        } else if (!hasSttOnlineApiSecretReference()) {
          throw new Error("请先填写 APISecret，再点击探测连接。");
        }
      }
      if (typedApiKey) {
        setSttOnlineApiKeyInMemory(typedApiKey);
      } else {
        await ensureSttOnlineApiKeyForSession();
      }
      await ensureSttOnlineApiSecretForSession();
      const cfg = buildDraftRuntimeConfig();
      const r = await probeExternalSttOnlineHealth({
        runtimeConfig: {
          ...cfg,
          apiKeyId: nextApiKeyId ?? savedApiKeyId ?? providerApiKeyId,
          ...(nextApiSecretId ?? savedApiSecretId
            ? { apiSecretId: nextApiSecretId ?? savedApiSecretId ?? providerApiSecretId }
            : {}),
        },
      });
      setLastProbeAvailable(r.available);
      if (r.available) {
        const verifiedCfg = {
          ...cfg,
          apiKeyId: nextApiKeyId ?? savedApiKeyId ?? providerApiKeyId,
          ...(nextApiSecretId ?? savedApiSecretId
            ? { apiSecretId: nextApiSecretId ?? savedApiSecretId ?? providerApiSecretId }
            : {}),
        };
        persistExternalSttOnlineRuntimeConfig(verifiedCfg);
        markSttConnectionVerified(verifiedCfg);
        setSttOnlineApiKeyInMemory(null);
        setSttOnlineApiSecretInMemory(null);
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
    olApiSecret,
    olProviderId,
    onSttOnlineRuntimeChanged,
    savedApiKeyId,
    savedApiSecretId,
  ]);

  const onProviderChange = useCallback(
    (id: string) => {
      if (id !== olProviderId) {
        const prevDef = getSttOnlineProviderDefinition(olProviderId);
        const nextDef = getSttOnlineProviderDefinition(id);
        setSttOnlineApiKeyInMemory(null);
        setSttOnlineApiSecretInMemory(null);
        setOlApiKey("");
        setOlApiSecret("");
        setOlEndpoint("");
        setLastProbeAvailable(null);
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
    [olProviderId, olTimeoutSec, onSttOnlineRuntimeChanged],
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
    onProviderChange,
    clearSavedApiKey,
    saveOnlineStt,
    probeOnlineStt,
  };
}
