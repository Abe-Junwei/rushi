import { Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CONTROL_BTN_PRIMARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { toast } from "../services/ui/toast";
import { buildOnlineSttEnvPresentation } from "../services/stt/onlineSttEnvStatus";
import {
  clearSttConnectionVerified,
  getSttOnlineProviderDefinition,
  glossaryBiasSummaryForProviderId,
  isSttConnectionVerified,
  markSttConnectionVerified,
  normalizeExternalSttOnlineRuntimeConfig,
  persistExternalSttOnlineRuntimeConfig,
  probeExternalSttOnlineHealth,
  readExternalSttOnlineRuntimeConfigFromStorage,
  setSttOnlineApiKeyInMemory,
} from "../services/stt/sttOnlineProviderContract";
import { EnvLlmStatusBanner } from "./EnvLlmStatusBanner";
import { EnvOnlineSttConfigCard } from "./envOnlineStt/EnvOnlineSttConfigCard";
import { OnlineSttProviderPicker } from "./envOnlineStt/OnlineSttProviderPicker";
import { OnlineSttRuntimeForm } from "./envOnlineStt/OnlineSttRuntimeForm";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type Props = {
  busy: boolean;
  onSttOnlineRuntimeChanged?: () => void;
};

export function EnvOnlineSttPanel({ busy, onSttOnlineRuntimeChanged }: Props) {
  const [olProviderId, setOlProviderId] = useState("openai");
  const [olEndpoint, setOlEndpoint] = useState("");
  const [olTimeoutSec, setOlTimeoutSec] = useState(30);
  const [olAppKey, setOlAppKey] = useState("");
  const [olApiKey, setOlApiKey] = useState("");
  const [olProbeBusy, setOlProbeBusy] = useState(false);
  const [lastProbeAvailable, setLastProbeAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const c = readExternalSttOnlineRuntimeConfigFromStorage();
    setOlProviderId(c.selectedProviderId);
    setOlEndpoint(c.endpoint ?? "");
    setOlAppKey(c.appKey ?? "");
    setOlTimeoutSec(Math.max(30, Math.round(c.timeoutMs / 1000)));
  }, []);

  const olDef = getSttOnlineProviderDefinition(olProviderId) ?? null;

  const draftConfig = useMemo(
    () =>
      normalizeExternalSttOnlineRuntimeConfig({
        enabled: true,
        selectedProviderId: olProviderId,
        endpoint: olEndpoint.trim() || undefined,
        appKey: olAppKey.trim() || undefined,
        timeoutMs: olTimeoutSec * 1000,
      }),
    [olAppKey, olEndpoint, olProviderId, olTimeoutSec],
  );

  const connectionVerified = useMemo(() => isSttConnectionVerified(draftConfig), [draftConfig]);

  const presentation = useMemo(
    () =>
      buildOnlineSttEnvPresentation({
        enabled: true,
        providerId: olProviderId,
        endpoint: olEndpoint,
        appKey: olAppKey,
        hasApiKeyInSession: olApiKey.trim().length > 0,
        connectionVerified,
        lastProbeAvailable,
        lastProbeMessage: null,
      }),
    [olAppKey, olEndpoint, olProviderId, connectionVerified, lastProbeAvailable],
  );

  const saveOnlineStt = useCallback(() => {
    setLastProbeAvailable(null);
    try {
      const n = normalizeExternalSttOnlineRuntimeConfig({
        enabled: true,
        selectedProviderId: olProviderId,
        endpoint: olEndpoint.trim() || undefined,
        appKey: olAppKey.trim() || undefined,
        timeoutMs: olTimeoutSec * 1000,
      });
      persistExternalSttOnlineRuntimeConfig(n);
      setSttOnlineApiKeyInMemory(olApiKey.trim() || null);
      toast.success("已保存在线 STT 配置。根密钥仍仅保留在当前页面会话内存。");
      onSttOnlineRuntimeChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }, [olApiKey, olAppKey, olEndpoint, olProviderId, olTimeoutSec, onSttOnlineRuntimeChanged]);

  const probeOnlineStt = useCallback(async () => {
    setOlProbeBusy(true);
    try {
      setSttOnlineApiKeyInMemory(olApiKey.trim() || null);
      const cfg = normalizeExternalSttOnlineRuntimeConfig({
        enabled: true,
        selectedProviderId: olProviderId,
        endpoint: olEndpoint.trim() || undefined,
        appKey: olAppKey.trim() || undefined,
        timeoutMs: olTimeoutSec * 1000,
      });
      const r = await probeExternalSttOnlineHealth({ runtimeConfig: cfg });
      setLastProbeAvailable(r.available);
      if (r.available) {
        markSttConnectionVerified(cfg);
        toast.success(`在线 STT 可达（约 ${r.latencyMs ?? "?"} ms）`);
      } else {
        toast.error(`${r.state}: ${r.message ?? ""}`.trim());
      }
      onSttOnlineRuntimeChanged?.();
    } catch (e) {
      setLastProbeAvailable(false);
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setOlProbeBusy(false);
    }
  }, [olApiKey, olAppKey, olEndpoint, olProviderId, olTimeoutSec, onSttOnlineRuntimeChanged]);

  const formBusy = busy || olProbeBusy;

  return (
    <div id="online-stt-provider" className="flex max-w-[860px] flex-col gap-7">
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
                setLastProbeAvailable(null);
                clearSttConnectionVerified();
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
            onEndpointChange={setOlEndpoint}
            onTimeoutSecChange={setOlTimeoutSec}
            onAppKeyChange={setOlAppKey}
            onApiKeyChange={setOlApiKey}
          />
        }
        footer={
          <>
            <span className="mr-auto" />
            <button type="button" className={CONTROL_BTN_PRIMARY} disabled={formBusy} onClick={saveOnlineStt}>
              保存在线配置
            </button>
          </>
        }
      />

      <div className="flex items-start gap-3 border-t border-notion-divider/60 pt-5">
        <Info className={`${LUCIDE_ICON_SIZE_SM} mt-0.5 shrink-0 text-notion-text-muted`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        <div className={`space-y-2 ${PANEL_TYPOGRAPHY.body}`}>
          <p className="m-0">
            国内 / 国际厂商分组展示；常见含试用或免费额的引擎带角标（以各厂商控制台为准）。OpenAI / AssemblyAI 由壳直接调
            API；其余厂商多需 TC3 签名、Token 或 WebSocket，当前版本请优先走<strong className="font-medium text-notion-text"> 自建 HTTPS 代理 </strong>
            并将响应归一为 Rushi JSON（multipart <code className="font-mono text-zen-indigo">file</code>）。
          </p>
          {glossaryBiasSummaryForProviderId(olProviderId)}
        </div>
      </div>
    </div>
  );
}
