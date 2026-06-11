import { Info } from "lucide-react";
import { formatSttProbeFailureMessage } from "../services/stt/sttProbeUserMessage";
import { useCallback, useEffect, useMemo, useState, type Ref } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { useSttKeychainReady } from "../hooks/useSttKeychainReady";
import { toast } from "../services/ui/toast";
import { waitMinVisibleBusy } from "../services/ui/minVisibleBusy";
import { buildOnlineSttEnvPresentation } from "../services/stt/onlineSttEnvStatus";
import { sttKeychainReferenceMessage } from "../services/stt/sttConnectionUi";
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
import { EnvLlmStatusBanner } from "./EnvLlmStatusBanner";
import { EnvOnlineSttConfigCard } from "./envOnlineStt/EnvOnlineSttConfigCard";
import { OnlineSttProviderPicker } from "./envOnlineStt/OnlineSttProviderPicker";
import { OnlineSttRuntimeForm } from "./envOnlineStt/OnlineSttRuntimeForm";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type Props = {
  busy: boolean;
  scrollAnchorRef?: Ref<HTMLDivElement>;
  onSttOnlineRuntimeChanged?: () => void;
};

export function EnvOnlineSttPanel({ busy, scrollAnchorRef, onSttOnlineRuntimeChanged }: Props) {
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

  const formBusy = busy || olProbeBusy || olSaveBusy;

  return (
    <div id="online-stt-provider" ref={scrollAnchorRef} className="flex max-w-[860px] flex-col gap-7">
      <EnvOnlineSttConfigCard
        banner={
          <EnvLlmStatusBanner
            connected
            presentation={{
              mode: "cloud",
              tone: presentation.tone,
              bannerTitle: presentation.bannerTitle,
              bannerDetail: presentation.bannerDetail,
            }}
            disabled={formBusy}
            busy={olProbeBusy}
            refreshLabel="探测连接"
            onRefresh={() => void probeOnlineStt()}
          />
        }
        provider={
          <OnlineSttProviderPicker
            busy={formBusy}
            providerId={olProviderId}
            onProviderChange={(id) => {
              if (id !== olProviderId) {
                setSttOnlineApiKeyInMemory(null);
                setOlApiKey("");
                setOlEndpoint("");
                setLastProbeAvailable(null);
                clearSttConnectionVerified();
                const def = getSttOnlineProviderDefinition(id);
                if (def) {
                  setOlTimeoutSec(
                    clampSttOnlineTimeoutSec(Math.round(def.defaultTimeoutMs / 1000)),
                  );
                }
              }
              setOlProviderId(id);
            }}
          />
        }
        form={
          <OnlineSttRuntimeForm
            busy={formBusy}
            providerId={olProviderId}
            providerDef={olDef}
            endpoint={olEndpoint}
            timeoutSec={olTimeoutSec}
            appKey={olAppKey}
            apiKey={olApiKey}
            savedApiKeyId={savedApiKeyId}
            keychainReady={keychainChecking ? null : keychainReady}
            onEndpointChange={setOlEndpoint}
            onTimeoutSecChange={(v) => setOlTimeoutSec(clampSttOnlineTimeoutSec(v))}
            onAppKeyChange={setOlAppKey}
            onApiKeyChange={setOlApiKey}
          />
        }
        footer={
          <>
            <button
              type="button"
              className={`${CONTROL_BTN_SECONDARY} mr-auto text-notion-text-muted`}
              disabled={formBusy || !savedApiKeyId}
              onClick={() => void clearSavedApiKey()}
            >
              清除已保存密钥
            </button>
            <button type="button" className={CONTROL_BTN_PRIMARY} disabled={formBusy} onClick={() => void saveOnlineStt()}>
              保存在线配置
            </button>
          </>
        }
      />

      <div className="flex items-start gap-3 border-t border-notion-divider/60 pt-5">
        <Info className={`${LUCIDE_ICON_SIZE_SM} mt-0.5 shrink-0 text-notion-text-muted`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        <div className={`space-y-2 ${PANEL_TYPOGRAPHY.body}`}>
          <p className="m-0">
            内置厂商端点已预置；仅「自定义代理」需填 HTTPS URL。
          </p>
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
            {sttKeychainReferenceMessage(
              normalizeSttApiKeyId(savedApiKeyId) ?? null,
              keychainChecking ? null : keychainReady,
            )}
          </p>
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
            本机 FunASR 通过 hotwords 携带术语偏置。
            {onlineGlossarySummary ? ` ${onlineGlossarySummary}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
