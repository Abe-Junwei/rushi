import { Info } from "lucide-react";
import { CONTROL_TEXT_INPUT, ENV_MONO_FIELD } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import {
  sttOnlineProviderAllowsEmptyEndpoint,
  type SttOnlineProviderDefinition,
} from "../../services/stt/sttOnlineProviderContract";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";

const fieldLabel = `mb-1.5 block ${PANEL_TYPOGRAPHY.envFieldLabel}`;
const monoField = `${CONTROL_TEXT_INPUT} ${ENV_MONO_FIELD}`;

type Props = {
  busy: boolean;
  providerId: string;
  providerDef: SttOnlineProviderDefinition | null;
  endpoint: string;
  timeoutSec: number;
  appKey: string;
  apiKey: string;
  onEndpointChange: (value: string) => void;
  onTimeoutSecChange: (value: number) => void;
  onAppKeyChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
};

export function OnlineSttRuntimeForm({
  busy,
  providerId,
  providerDef,
  endpoint,
  timeoutSec,
  appKey,
  apiKey,
  onEndpointChange,
  onTimeoutSecChange,
  onAppKeyChange,
  onApiKeyChange,
}: Props) {
  const providerLabel = providerDef?.label ?? providerId;
  const authSummary =
    providerDef?.authStyle === "header" && providerDef.headerName
      ? `HTTP 头 ${providerDef.headerName}`
      : "标准 Bearer / API Key";

  return (
    <div className="space-y-6">
      <p className="m-0 text-[11px] text-notion-text-muted">
        当前厂商：<span className="font-medium text-notion-text">{providerLabel}</span>
        {" · "}
        鉴权：<span className="font-medium text-notion-text">{authSummary}</span>
      </p>

      <label className={fieldLabel}>
        转写 POST 完整 URL
        <input
          type="url"
          className={`${monoField} mt-0`}
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

      <label className={fieldLabel}>
        超时（秒，30–600）
        <input
          type="number"
          min={30}
          max={600}
          className={`${CONTROL_TEXT_INPUT} mt-0`}
          value={timeoutSec}
          onChange={(e) => onTimeoutSecChange(Number(e.target.value) || 30)}
          disabled={busy}
        />
      </label>

      {providerDef?.requiresPersistedAppKey ? (
        <label className={fieldLabel}>
          {providerDef.persistedAppKeyFieldLabel ?? "应用标识（可持久化）"}
          <input
            type="text"
            className={`${monoField} mt-0`}
            value={appKey}
            onChange={(e) => onAppKeyChange(e.target.value)}
            placeholder="与控制台一致，保存在本机配置"
            disabled={busy}
            autoComplete="off"
          />
        </label>
      ) : null}

      <label className={fieldLabel}>
        {providerDef?.authStyle === "header" && providerDef.headerName
          ? `根凭证 / Token（仅内存，HTTP 头 ${providerDef.headerName}）`
          : "根凭证 / API Key（仅内存，不落盘）"}
        <input
          type="password"
          className={`${monoField} mt-0`}
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="sk-… 或代理签发令牌"
          disabled={busy}
          autoComplete="off"
        />
        <p className={`mt-1.5 flex items-center gap-1 ${PANEL_TYPOGRAPHY.meta}`}>
          <Info className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          根凭证仅保留在当前页面会话内存，关闭页面后需重新输入。
        </p>
      </label>
    </div>
  );
}
