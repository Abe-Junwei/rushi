import {
  sttOnlineProviderAllowsEmptyEndpoint,
  type SttOnlineProviderDefinition,
} from "../../services/stt/sttOnlineProviderContract";
import "./onlineSttRuntimeForm.css";

type Props = {
  busy: boolean;
  probeBusy: boolean;
  fieldClassName: string;
  btnPrimaryClassName: string;
  btnSecondaryClassName: string;
  providerId: string;
  providerDef: SttOnlineProviderDefinition | null;
  endpoint: string;
  timeoutSec: number;
  appKey: string;
  apiKey: string;
  message: string | null;
  onEndpointChange: (value: string) => void;
  onTimeoutSecChange: (value: number) => void;
  onAppKeyChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onSave: () => void;
  onProbe: () => void;
};

export function OnlineSttRuntimeForm({
  busy,
  probeBusy,
  fieldClassName,
  btnPrimaryClassName,
  btnSecondaryClassName,
  providerId,
  providerDef,
  endpoint,
  timeoutSec,
  appKey,
  apiKey,
  message,
  onEndpointChange,
  onTimeoutSecChange,
  onAppKeyChange,
  onApiKeyChange,
  onSave,
  onProbe,
}: Props) {
  const providerLabel = providerDef?.label ?? providerId;
  const authSummary =
    providerDef?.authStyle === "header" && providerDef.headerName
      ? `HTTP 头 ${providerDef.headerName}`
      : "标准 Bearer / API Key";
  const messageToneClass = message ? (message.includes("可达") ? " stt-runtime-form__message--success" : " stt-runtime-form__message--error") : "";

  return (
    <section className="stt-runtime-form">
      <div className="stt-runtime-form__summary" role="status" aria-live="polite">
        <p className="stt-runtime-form__summary-line">
          当前厂商：<span className="stt-runtime-form__summary-value">{providerLabel}</span>
        </p>
        <p className="stt-runtime-form__summary-line">
          鉴权方式：<span className="stt-runtime-form__summary-value">{authSummary}</span>
        </p>
      </div>

      <label className="stt-runtime-form__field block text-[11px] font-medium text-zen-ink">
        转写 POST 完整 URL
        <input
          type="url"
          className={`${fieldClassName} mt-0.5 font-mono text-[11px]`}
          value={endpoint}
          onChange={(e) => onEndpointChange(e.target.value)}
          placeholder={
            sttOnlineProviderAllowsEmptyEndpoint(providerId)
              ? "可留空：OpenAI 默认 api.openai.com；AssemblyAI 默认 api.assemblyai.com"
              : providerDef?.defaultEndpointExample
                ? `示例：${providerDef.defaultEndpointExample}`
                : "https://你的网关/v1/transcribe"
          }
          disabled={busy}
          autoComplete="off"
        />
      </label>

      <label className="stt-runtime-form__field block text-[11px] font-medium text-zen-ink">
        超时（秒，30–600）
        <input
          type="number"
          min={30}
          max={600}
          className={`${fieldClassName} mt-0.5`}
          value={timeoutSec}
          onChange={(e) => onTimeoutSecChange(Number(e.target.value) || 30)}
          disabled={busy}
        />
      </label>

      {providerDef?.requiresPersistedAppKey ? (
        <label className="stt-runtime-form__field block text-[11px] font-medium text-zen-ink">
          {providerDef.persistedAppKeyFieldLabel ?? "应用标识（可持久化）"}
          <input
            type="text"
            className={`${fieldClassName} mt-0.5 font-mono text-[11px]`}
            value={appKey}
            onChange={(e) => onAppKeyChange(e.target.value)}
            placeholder="与控制台一致，保存在本机配置"
            disabled={busy}
            autoComplete="off"
          />
        </label>
      ) : null}

      <label className="stt-runtime-form__field block text-[11px] font-medium text-zen-ink">
        {providerDef?.authStyle === "header" && providerDef.headerName
          ? `根凭证 / Token（仅内存，HTTP 头 ${providerDef.headerName}）`
          : "根凭证 / API Key（仅内存，不落盘）"}
        <input
          type="password"
          className={`${fieldClassName} mt-0.5 font-mono text-[11px]`}
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="sk-… 或代理签发令牌"
          disabled={busy}
          autoComplete="off"
        />
      </label>

      <div className="stt-runtime-form__actions flex flex-wrap gap-2">
        <button type="button" className={btnPrimaryClassName} disabled={busy} onClick={onSave}>
          保存在线配置
        </button>
        <button type="button" className={btnSecondaryClassName} disabled={busy || probeBusy} onClick={onProbe}>
          {probeBusy ? "探测中…" : "探测连接"}
        </button>
      </div>

      {message ? <p className={`stt-runtime-form__message text-[11px]${messageToneClass}`}>{message}</p> : null}
    </section>
  );
}
