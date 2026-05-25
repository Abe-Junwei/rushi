import { useCallback, useEffect, useState } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY, CONTROL_TEXT_INPUT } from "../config/controlStyles";
import {
  getSttOnlineProviderDefinition,
  normalizeExternalSttOnlineRuntimeConfig,
  persistExternalSttOnlineRuntimeConfig,
  probeExternalSttOnlineHealth,
  readExternalSttOnlineRuntimeConfigFromStorage,
  setSttOnlineApiKeyInMemory,
} from "../services/stt/sttOnlineProviderContract";
import { OnlineSttProviderPicker } from "./envOnlineStt/OnlineSttProviderPicker";
import { OnlineSttRuntimeForm } from "./envOnlineStt/OnlineSttRuntimeForm";

const btnPrimary = CONTROL_BTN_PRIMARY;
const btnSecondary = CONTROL_BTN_SECONDARY;
const field = CONTROL_TEXT_INPUT;

type Props = {
  busy: boolean;
  onSttOnlineRuntimeChanged?: () => void;
};

export function EnvOnlineSttPanel({ busy, onSttOnlineRuntimeChanged }: Props) {
  const [olEnabled, setOlEnabled] = useState(false);
  const [olProviderId, setOlProviderId] = useState("openai");
  const [olEndpoint, setOlEndpoint] = useState("");
  const [olTimeoutSec, setOlTimeoutSec] = useState(30);
  const [olAppKey, setOlAppKey] = useState("");
  const [olApiKey, setOlApiKey] = useState("");
  const [olMsg, setOlMsg] = useState<string | null>(null);
  const [olProbeBusy, setOlProbeBusy] = useState(false);

  useEffect(() => {
    const c = readExternalSttOnlineRuntimeConfigFromStorage();
    setOlEnabled(c.enabled);
    setOlProviderId(c.selectedProviderId);
    setOlEndpoint(c.endpoint ?? "");
    setOlAppKey(c.appKey ?? "");
    setOlTimeoutSec(Math.max(30, Math.round(c.timeoutMs / 1000)));
  }, []);

  const saveOnlineStt = useCallback(() => {
    setOlMsg(null);
    try {
      const n = normalizeExternalSttOnlineRuntimeConfig({
        enabled: olEnabled,
        selectedProviderId: olProviderId,
        endpoint: olEndpoint.trim() || undefined,
        appKey: olAppKey.trim() || undefined,
        timeoutMs: olTimeoutSec * 1000,
      });
      persistExternalSttOnlineRuntimeConfig(n);
      setSttOnlineApiKeyInMemory(olApiKey.trim() || null);
      setOlMsg("已保存。应用标识（若有）已写入本机配置；根密钥仅保留在当前页面会话内存。");
      onSttOnlineRuntimeChanged?.();
    } catch (e) {
      setOlMsg(e instanceof Error ? e.message : String(e));
    }
  }, [olApiKey, olAppKey, olEnabled, olEndpoint, olProviderId, olTimeoutSec, onSttOnlineRuntimeChanged]);

  const probeOnlineStt = useCallback(async () => {
    setOlProbeBusy(true);
    setOlMsg(null);
    try {
      setSttOnlineApiKeyInMemory(olApiKey.trim() || null);
      const cfg = normalizeExternalSttOnlineRuntimeConfig({
        enabled: olEnabled,
        selectedProviderId: olProviderId,
        endpoint: olEndpoint.trim() || undefined,
        appKey: olAppKey.trim() || undefined,
        timeoutMs: olTimeoutSec * 1000,
      });
      const r = await probeExternalSttOnlineHealth({ runtimeConfig: cfg });
      setOlMsg(r.available ? `可达（约 ${r.latencyMs ?? "?"} ms）` : `${r.state}: ${r.message ?? ""}`);
      onSttOnlineRuntimeChanged?.();
    } catch (e) {
      setOlMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setOlProbeBusy(false);
    }
  }, [olApiKey, olAppKey, olEnabled, olEndpoint, olProviderId, olTimeoutSec, onSttOnlineRuntimeChanged]);

  const olDef = getSttOnlineProviderDefinition(olProviderId) ?? null;

  return (
    <div id="online-stt-provider" className="space-y-2">
      <h3 className="text-[12px] font-semibold text-zen-ink">在线 STT（实验）</h3>
      <p className="text-[11px] text-zen-stone">
        厂商按<strong className="text-zen-ink"> 国内 / 国际 </strong>
        分组列表展示；各组内<strong className="text-zen-ink"> 常见含试用/免费额 </strong>
        的引擎排在前面（角标「试用/免费额」悬停可看备注，以各厂商控制台为准）。OpenAI / AssemblyAI 由壳直接调 API；其余厂商多为
        <strong className="text-zen-ink"> TC3 签名、Token 轮询或 WebSocket</strong>
        ，当前版本请优先走<strong className="text-zen-ink"> 自建 HTTPS 代理 </strong>
        ，将响应归一为 Rushi JSON（multipart <code className="font-mono text-zen-indigo">file</code>
        ）。若厂商需 AppKey + 根密钥：AppKey 可持久化，根密钥仅内存。OpenAI 下术语表热词会作为{" "}
        <code className="font-mono text-zen-indigo">prompt</code>（≤224 字）附加。
      </p>
      <label className="flex cursor-pointer items-center gap-2 text-zen-ink">
        <input type="checkbox" checked={olEnabled} onChange={(e) => setOlEnabled(e.target.checked)} disabled={busy} />
        启用在线 STT（关闭则仍走本机基址）
      </label>

      <OnlineSttProviderPicker busy={busy} providerId={olProviderId} onProviderChange={setOlProviderId} />

      <OnlineSttRuntimeForm
        busy={busy}
        probeBusy={olProbeBusy}
        fieldClassName={field}
        btnPrimaryClassName={btnPrimary}
        btnSecondaryClassName={btnSecondary}
        providerId={olProviderId}
        providerDef={olDef}
        endpoint={olEndpoint}
        timeoutSec={olTimeoutSec}
        appKey={olAppKey}
        apiKey={olApiKey}
        message={olMsg}
        onEndpointChange={setOlEndpoint}
        onTimeoutSecChange={setOlTimeoutSec}
        onAppKeyChange={setOlAppKey}
        onApiKeyChange={setOlApiKey}
        onSave={saveOnlineStt}
        onProbe={() => {
          void probeOnlineStt();
        }}
      />
    </div>
  );
}
