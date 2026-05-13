import { useCallback, useEffect, useState } from "react";
import {
  getSttOnlineProviderDefinition,
  normalizeExternalSttOnlineRuntimeConfig,
  persistExternalSttOnlineRuntimeConfig,
  probeExternalSttOnlineHealth,
  readExternalSttOnlineRuntimeConfigFromStorage,
  setSttOnlineApiKeyInMemory,
  sttOnlineProviderAllowsEmptyEndpoint,
  sttOnlineProvidersByMarket,
} from "../services/stt/sttOnlineProviderContract";
import type { SttOnlineMarket } from "../services/stt/sttOnlineProviderContract";
import "./p1OnlineSttProviderList.css";

const btnPrimary =
  "rounded px-3 py-1.5 text-xs font-medium bg-zen-saffron text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const btnSecondary =
  "rounded border border-black/10 bg-white/60 px-3 py-1.5 text-xs text-zen-ink transition-colors hover:border-zen-saffron/35 hover:text-zen-saffron disabled:cursor-not-allowed disabled:opacity-40";

const field =
  "block w-full rounded border border-black/10 bg-white/80 px-2 py-1 text-xs text-zen-ink outline-none transition-colors focus:border-zen-saffron/45 focus:ring-1 focus:ring-zen-saffron/20 disabled:cursor-not-allowed disabled:opacity-40";

const STT_MARKET_GROUPS: { market: SttOnlineMarket; label: string }[] = [
  { market: "china", label: "国内（中国区 / 合规云厂商）" },
  { market: "global", label: "国际" },
];

type Props = {
  busy: boolean;
  onSttOnlineRuntimeChanged?: () => void;
};

export function P1EnvOnlineSttPanel({ busy, onSttOnlineRuntimeChanged }: Props) {
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

  const olDef = getSttOnlineProviderDefinition(olProviderId);

  return (
    <div id="p1-online-stt-provider" className="space-y-2">
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
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-zen-ink">厂商（影响鉴权头与配置项）</p>
        <div className="p1-stt-provider-list" role="radiogroup" aria-label="选择在线 STT 厂商">
          {STT_MARKET_GROUPS.map(({ market, label: groupLabel }) => (
            <div key={market} className="p1-stt-provider-group">
              <p className="p1-stt-provider-group-title">{groupLabel}</p>
              <ul>
                {sttOnlineProvidersByMarket(market).map((d) => {
                  const selected = d.id === olProviderId;
                  const marketShort = market === "china" ? "国内" : "国际";
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={busy}
                        onClick={() => setOlProviderId(d.id)}
                        className={`p1-stt-provider-card${selected ? " p1-stt-provider-card--selected" : ""}`}
                      >
                        <div className="p1-stt-provider-card__head">
                          <span className="p1-stt-provider-card__title">{d.label}</span>
                          <span className="p1-stt-provider-card__market">{marketShort}</span>
                        </div>
                        <p className="p1-stt-provider-card__desc">{d.description}</p>
                        <div className="p1-stt-provider-card__meta">
                          {d.experimental ? <span className="p1-stt-provider-chip p1-stt-provider-chip--accent">实验</span> : null}
                          {d.freeTierNote ? (
                            <span className="p1-stt-provider-chip" title={d.freeTierNote}>
                              试用 / 免费额
                            </span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
      {olDef?.docsUrl && olDef.docsUrl.startsWith("http") && !olDef.docsUrl.includes("example.com") ? (
        <p className="text-[10px] text-zen-stone">
          文档:{" "}
          <a
            href={olDef.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-zen-indigo underline decoration-zen-indigo/30 hover:text-zen-saffron"
          >
            {olDef.docsUrl.replace(/^https?:\/\//, "").split("/")[0]}
          </a>
        </p>
      ) : null}
      <label className="block text-[11px] font-medium text-zen-ink">
        转写 POST 完整 URL
        <input
          type="url"
          className={`${field} mt-0.5 font-mono text-[11px]`}
          value={olEndpoint}
          onChange={(e) => setOlEndpoint(e.target.value)}
          placeholder={
            sttOnlineProviderAllowsEmptyEndpoint(olProviderId)
              ? "可留空：OpenAI 默认 api.openai.com；AssemblyAI 默认 api.assemblyai.com"
              : olDef?.defaultEndpointExample
                ? `示例：${olDef.defaultEndpointExample}`
                : "https://你的网关/v1/transcribe"
          }
          disabled={busy}
          autoComplete="off"
        />
      </label>
      <label className="block text-[11px] font-medium text-zen-ink">
        超时（秒，30–600）
        <input
          type="number"
          min={30}
          max={600}
          className={`${field} mt-0.5`}
          value={olTimeoutSec}
          onChange={(e) => setOlTimeoutSec(Number(e.target.value) || 30)}
          disabled={busy}
        />
      </label>
      {olDef?.requiresPersistedAppKey ? (
        <label className="block text-[11px] font-medium text-zen-ink">
          {olDef.persistedAppKeyFieldLabel ?? "应用标识（可持久化）"}
          <input
            type="text"
            className={`${field} mt-0.5 font-mono text-[11px]`}
            value={olAppKey}
            onChange={(e) => setOlAppKey(e.target.value)}
            placeholder="与控制台一致，保存在本机配置"
            disabled={busy}
            autoComplete="off"
          />
        </label>
      ) : null}
      <label className="block text-[11px] font-medium text-zen-ink">
        {olDef?.authStyle === "header" && olDef.headerName
          ? `根凭证 / Token（仅内存，HTTP 头 ${olDef.headerName}）`
          : "根凭证 / API Key（仅内存，不落盘）"}
        <input
          type="password"
          className={`${field} mt-0.5 font-mono text-[11px]`}
          value={olApiKey}
          onChange={(e) => setOlApiKey(e.target.value)}
          placeholder="sk-… 或代理签发令牌"
          disabled={busy}
          autoComplete="off"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={busy} onClick={saveOnlineStt}>
          保存在线配置
        </button>
        <button type="button" className={btnSecondary} disabled={busy || olProbeBusy} onClick={() => void probeOnlineStt()}>
          {olProbeBusy ? "探测中…" : "探测连接"}
        </button>
      </div>
      {olMsg ? <p className="text-[11px] text-zen-indigo">{olMsg}</p> : null}
    </div>
  );
}
