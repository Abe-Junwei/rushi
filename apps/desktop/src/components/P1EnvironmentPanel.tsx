import { useCallback, useEffect, useState } from "react";
import { asrBaseUrl, asrHealthUrl, isDefaultBundledAsrTarget } from "../config/env";
import {
  STT_ONLINE_PROVIDER_DEFINITIONS,
  getSttOnlineProviderDefinition,
  normalizeExternalSttOnlineRuntimeConfig,
  persistExternalSttOnlineRuntimeConfig,
  probeExternalSttOnlineHealth,
  readExternalSttOnlineRuntimeConfigFromStorage,
  setSttOnlineApiKeyInMemory,
  sttOnlineProviderAllowsEmptyEndpoint,
} from "../services/stt/sttOnlineProviderContract";
import type { SttOnlineMarket } from "../services/stt/sttOnlineProviderContract";
import type { AsrHealthCapabilities, BundledAsrLaunchReport } from "../tauri/p1Api";
import type { AsrHealthState } from "../pages/useProjectP1Controller";
import { funasrManualSetupCommands } from "../pages/useProjectP1Controller";
import type { PrepareModelFailureCopy } from "../pages/prepareModelDownloadCopy";

const STT_MARKET_GROUPS: { market: SttOnlineMarket; label: string }[] = [
  { market: "china", label: "国内（中国区 / 合规云厂商）" },
  { market: "global", label: "国际" },
];
const btnPrimary =
  "rounded px-3 py-1.5 text-xs font-medium bg-zen-saffron text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const btnSecondary =
  "rounded border border-black/10 bg-white/60 px-3 py-1.5 text-xs text-zen-ink transition-colors hover:border-zen-saffron/35 hover:text-zen-saffron disabled:cursor-not-allowed disabled:opacity-40";

const field =
  "block w-full rounded border border-black/10 bg-white/80 px-2 py-1 text-xs text-zen-ink outline-none transition-colors focus:border-zen-saffron/45 focus:ring-1 focus:ring-zen-saffron/20 disabled:cursor-not-allowed disabled:opacity-40";

export type P1EnvironmentPanelProps = {
  asrHealth: AsrHealthState;
  asrHealthDetail: string;
  bundledAsrDiag: BundledAsrLaunchReport | null;
  asrCaps: AsrHealthCapabilities | null;
  funasrInstallMessage: string;
  prepareModelBusy: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelFailureCopy | null;
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
  installFunasrDepsInteractive: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
  prepareDefaultFunasrModel: () => Promise<void>;
  retryBundledAsrSidecar: () => Promise<void>;
  openAppDataFolder: () => Promise<void>;
  /** 在线 STT 保存 / 探测后通知主舞台刷新「仅在线可转写」等 UI。 */
  onSttOnlineRuntimeChanged?: () => void;
};

export function P1EnvironmentPanel({
  asrHealth,
  asrHealthDetail,
  bundledAsrDiag,
  asrCaps,
  funasrInstallMessage,
  prepareModelBusy,
  prepareModelProgress,
  prepareModelFailure,
  busy,
  refreshAsrHealth,
  installFunasrDepsInteractive,
  copyFunasrManualCommands,
  prepareDefaultFunasrModel,
  retryBundledAsrSidecar,
  openAppDataFolder,
  onSttOnlineRuntimeChanged,
}: P1EnvironmentPanelProps) {
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
    <div className="space-y-3 border-t border-black/[0.06] bg-zen-paper/90 px-4 py-3">
      <details className="rounded border border-black/[0.05] bg-white/30 text-[12px] leading-relaxed text-zen-stone open:bg-white/45">
        <summary className="cursor-pointer px-3 py-2 font-medium text-zen-ink outline-none transition-colors hover:text-zen-saffron">
          使用说明（自动转写与保存）
        </summary>
        <div className="border-t border-black/[0.05] px-3 py-2">
          <p className="mb-2">
            创建或打开项目后，点「<strong className="text-zen-ink">从 ASR 拉取语段</strong>」将音频发往
            <strong className="text-zen-ink"> 本机 ASR </strong>
            或（若已启用）<strong className="text-zen-ink">在线 STT</strong>
            ，时间段与文本填入表格；修改后请「
            <strong className="text-zen-ink">保存到 SQLite</strong>」。
          </p>
          <p>
            未配置 FunASR 时多为 <strong className="text-zen-ink">stub</strong>（语段常有、正文或为空）。请先启动{" "}
            <code className="rounded bg-black/[0.04] px-1 py-0.5 font-mono text-[11px] text-zen-indigo">python -m rushi_asr</code>。
          </p>
        </div>
      </details>

      <details className="rounded border border-black/[0.05] bg-white/30 text-[12px] leading-relaxed text-zen-stone open:bg-white/45">
        <summary className="cursor-pointer px-3 py-2 font-medium text-zen-ink outline-none transition-colors hover:text-zen-saffron">
          在线 STT（实验）
        </summary>
        <div className="space-y-2 border-t border-black/[0.05] px-3 py-2">
          <p className="text-[11px] text-zen-stone">
            厂商列表按<strong className="text-zen-ink"> 国内 / 国际 </strong>
            分组（与解语 acoustic Provider 分区习惯一致）。OpenAI / AssemblyAI 由壳直接调 API；其余厂商多为
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
          <label className="block text-[11px] font-medium text-zen-ink">
            厂商（影响鉴权头与配置项）
            <select
              className={`${field} mt-0.5`}
              value={olProviderId}
              onChange={(e) => setOlProviderId(e.target.value)}
              disabled={busy}
            >
              {STT_MARKET_GROUPS.map(({ market, label }) => (
                <optgroup key={market} label={label}>
                  {STT_ONLINE_PROVIDER_DEFINITIONS.filter((d) => d.market === market).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                      {d.experimental ? "（实验）" : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {olDef?.docsUrl && olDef.docsUrl.startsWith("http") && !olDef.docsUrl.includes("example.com") ? (
            <p className="text-[10px] text-zen-stone">
              文档：{" "}
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
      </details>

      {funasrInstallMessage && !prepareModelBusy ? (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded border border-black/[0.06] bg-white/50 p-2 font-mono text-[11px] text-zen-indigo">
          {funasrInstallMessage}
        </pre>
      ) : null}

      {asrHealth === "ok" && asrCaps && !asrCaps.ffmpeg_ok ? (
        <div className="rounded border border-black/[0.06] bg-zen-ochre/50 px-3 py-2 text-sm">
          <strong className="text-zen-ink">未检测到 FFmpeg</strong>
          <span className="text-zen-stone"> — ASR 无法解码上传音频。请安装 ffmpeg/ffprobe 并加入 PATH 后重启 ASR。</span>
        </div>
      ) : null}

      {asrHealth === "ok" && asrCaps && asrCaps.ffmpeg_ok && !asrCaps.funasr_ready ? (
        <div className="space-y-2 rounded border border-black/[0.06] bg-zen-ochre/45 px-3 py-2 text-sm">
          <p>
            <strong className="text-zen-ink">FunASR 未就绪</strong>
            <span className="text-zen-stone">（stub：中文正文常为空）。安装依赖并重启 ASR；可选 </span>
            <code className="rounded bg-black/[0.04] px-1 font-mono text-[11px]">RUSHI_FUNASR_MODEL</code>。
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={busy} onClick={() => void installFunasrDepsInteractive()}>
              一键安装 FunASR 依赖
            </button>
            <button type="button" className={btnSecondary} disabled={busy} onClick={() => void copyFunasrManualCommands()}>
              复制手动命令
            </button>
          </div>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-black/[0.03] p-2 font-mono text-[10px] text-zen-indigo">
            {funasrManualSetupCommands()}
          </pre>
        </div>
      ) : null}

      {asrHealth === "error" ? (
        <div className="space-y-2 rounded border border-zen-cinnabar/25 bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar">
          <p>{asrHealthDetail}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnSecondary} disabled={busy} onClick={() => void refreshAsrHealth()}>
              重新检测 ASR
            </button>
            {isDefaultBundledAsrTarget() && bundledAsrDiag?.attempted ? (
              <button type="button" className={btnSecondary} disabled={busy} onClick={() => void retryBundledAsrSidecar()}>
                重试内置侧车
              </button>
            ) : null}
            <button type="button" className={btnSecondary} disabled={busy} onClick={() => void openAppDataFolder()}>
              打开应用数据目录
            </button>
          </div>
          <p className="text-[11px] text-zen-stone">
            基址 <code className="font-mono text-zen-indigo">{asrBaseUrl()}</code> · <code className="font-mono">VITE_ASR_BASE_URL</code>
          </p>
        </div>
      ) : null}

      {asrHealth === "ok" ? (
        <div className="space-y-2 text-[12px] text-zen-stone">
          {asrCaps ? (
            <p className="leading-relaxed">
              模型 <code className="font-mono text-zen-indigo">{asrCaps.funasr_model_id ?? "—"}</code>
              {asrCaps.funasr_model_explicit_from_env ? "（环境变量）" : "（内置默认）"}
              {" · "}
              权重缓存：
              {asrCaps.rushi_models_root ? (
                <code className="break-all font-mono text-[10px] text-zen-indigo">{asrCaps.rushi_models_root}</code>
              ) : (
                "—"
              )}
            </p>
          ) : (
            <p>（ASR 未返回能力字段，请升级 rushi-asr。）</p>
          )}
          {asrCaps && asrCaps.funasr_import_ok && !asrCaps.funasr_default_model_cached ? (
            <div className="space-y-2 rounded border border-black/[0.06] bg-white/40 p-2">
              <button type="button" className={btnSecondary} disabled={busy || prepareModelBusy} onClick={() => void prepareDefaultFunasrModel()}>
                {prepareModelBusy ? "正在下载默认模型…" : "预先下载默认模型"}
              </button>
              {prepareModelBusy ? (
                <div className="space-y-1" aria-live="polite">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-black/[0.08]"
                    role="progressbar"
                    aria-valuenow={prepareModelProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="h-full bg-zen-saffron transition-[width]" style={{ width: `${prepareModelProgress}%` }} />
                  </div>
                  {funasrInstallMessage ? (
                    <pre className="max-h-28 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-zen-indigo">{funasrInstallMessage}</pre>
                  ) : null}
                </div>
              ) : null}
              {prepareModelFailure ? (
                <div className="rounded border border-zen-cinnabar/20 bg-zen-cinnabar/10 p-2 text-zen-cinnabar" role="alert">
                  <p className="font-medium">{prepareModelFailure.headline}</p>
                  <ul className="mt-1 list-inside list-disc text-[11px]">
                    {prepareModelFailure.tips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={btnSecondary} disabled={busy || prepareModelBusy} onClick={() => void prepareDefaultFunasrModel()}>
                      重试下载
                    </button>
                    <button type="button" className={btnSecondary} disabled={busy} onClick={() => void refreshAsrHealth()}>
                      重新检测 ASR
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <details className="rounded border border-black/[0.05] bg-white/30 text-[12px] text-zen-stone">
        <summary className="cursor-pointer px-3 py-2 outline-none hover:text-zen-saffron">没有中文稿？</summary>
        <ol className="list-inside list-decimal space-y-1 border-t border-black/[0.05] px-3 py-2 leading-relaxed">
          <li>
            识别在<strong className="text-zen-ink">本机另一进程</strong>（默认 <code className="font-mono text-zen-indigo">{asrHealthUrl()}</code>）。
          </li>
          <li>
            终端进入 <code className="font-mono text-zen-indigo">services/asr</code> 的 venv，执行{" "}
            <code className="font-mono text-zen-indigo">python -m rushi_asr</code>。
          </li>
          <li>stub 下正文常为空属占位，非故障。</li>
          <li>
            详见仓库内 <code className="font-mono text-zen-indigo">services/asr/README.md</code>。
          </li>
        </ol>
      </details>
    </div>
  );
}
