import { Info } from "lucide-react";
import { useEffect, useState } from "react";
import { CONTROL_TEXT_INPUT, ENV_MONO_FIELD } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import {
  clampSttOnlineTimeoutSec,
  STT_ONLINE_TIMEOUT_SEC_MAX,
  STT_ONLINE_TIMEOUT_SEC_MIN,
} from "../../services/stt/sttOnlineProviderContract/runtimeConfig";
import {
  resolveSttOnlinePresetEndpointDisplay,
  sttOnlineProviderEndpointUserConfigurable,
  type SttOnlineProviderDefinition,
} from "../../services/stt/sttOnlineProviderContract";
import {
  isSavedApiKeyMaskDisplayed,
  normalizeSavedApiKeyInputChange,
  resolveSavedApiKeyInputDisplay,
} from "../../services/secrets/savedApiKeyInput";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";

const fieldLabel = `mb-1.5 block ${PANEL_TYPOGRAPHY.envFieldLabel}`;
const monoField = `${CONTROL_TEXT_INPUT} ${ENV_MONO_FIELD}`;
const presetEndpointDisplay =
  "mt-1.5 break-all rounded-sm border border-notion-border bg-notion-bg-secondary/60 px-3 py-2 font-mono text-[11px] font-normal normal-case leading-relaxed text-notion-text-muted";

type Props = {
  busy: boolean;
  providerId: string;
  providerDef: SttOnlineProviderDefinition | null;
  endpoint: string;
  timeoutSec: number;
  appKey: string;
  apiKey: string;
  savedApiKeyId: string | null;
  keychainReady?: boolean | null;
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
  savedApiKeyId,
  keychainReady = null,
  onEndpointChange,
  onTimeoutSecChange,
  onAppKeyChange,
  onApiKeyChange,
}: Props) {
  const providerLabel = providerDef?.label ?? providerId;
  const [timeoutInput, setTimeoutInput] = useState(String(timeoutSec));

  useEffect(() => {
    setTimeoutInput(String(timeoutSec));
  }, [timeoutSec]);

  const commitTimeoutInput = () => {
    const clamped = clampSttOnlineTimeoutSec(Number(timeoutInput));
    setTimeoutInput(String(clamped));
    if (clamped !== timeoutSec) onTimeoutSecChange(clamped);
  };

  const authSummary =
    providerDef?.authStyle === "header" && providerDef.headerName
      ? `HTTP 头 ${providerDef.headerName}`
      : "标准 Bearer / API Key";
  const presetDisplay = resolveSttOnlinePresetEndpointDisplay(providerId);
  const showCustomEndpoint = sttOnlineProviderEndpointUserConfigurable(providerId);
  const showSavedApiKeyMask = isSavedApiKeyMaskDisplayed(apiKey, savedApiKeyId, keychainReady);
  const apiKeyDisplay = resolveSavedApiKeyInputDisplay({
    typedApiKey: apiKey,
    savedApiKeyId,
    keychainReady,
  });

  return (
    <div className="space-y-6">
      <p className="m-0 text-[11px] text-notion-text-muted">
        当前厂商：<span className="font-medium text-notion-text">{providerLabel}</span>
        {" · "}
        鉴权：<span className="font-medium text-notion-text">{authSummary}</span>
      </p>

      {showCustomEndpoint ? (
        <label className={fieldLabel}>
          转写 POST 完整 URL
          <input
            type="url"
            className={`${monoField} mt-0`}
            value={endpoint}
            onChange={(e) => onEndpointChange(e.target.value)}
            placeholder="https://你的网关/v1/transcribe"
            disabled={busy}
            autoComplete="off"
          />
        </label>
      ) : presetDisplay ? (
        <div>
          <p className={fieldLabel}>预置转写端点</p>
          <p className={presetEndpointDisplay} title={presetDisplay} aria-readonly>
            {presetDisplay}
          </p>
          <p className={`mt-1.5 flex items-center gap-1 ${PANEL_TYPOGRAPHY.meta}`}>
            <Info className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            无需填 URL，保存凭证即可。
          </p>
        </div>
      ) : null}

      <label className={fieldLabel}>
        超时（秒，{STT_ONLINE_TIMEOUT_SEC_MIN}–{STT_ONLINE_TIMEOUT_SEC_MAX}）
        <input
          type="number"
          min={STT_ONLINE_TIMEOUT_SEC_MIN}
          max={STT_ONLINE_TIMEOUT_SEC_MAX}
          step={1}
          inputMode="numeric"
          className={`${CONTROL_TEXT_INPUT} mt-0`}
          value={timeoutInput}
          onChange={(e) => setTimeoutInput(e.target.value)}
          onBlur={commitTimeoutInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          disabled={busy}
        />
        <p className={`mt-1.5 ${PANEL_TYPOGRAPHY.meta}`}>
          修改后需点击「保存在线配置」或「探测连接」才会用于转写。
        </p>
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
          ? `根凭证 / Token（HTTP 头 ${providerDef.headerName}）`
          : "根凭证 / API Key"}
        <input
          type="password"
          className={`${monoField} mt-0`}
          value={apiKeyDisplay}
          onFocus={(e) => {
            if (showSavedApiKeyMask) e.currentTarget.select();
          }}
          onChange={(e) =>
            onApiKeyChange(normalizeSavedApiKeyInputChange(e.target.value, showSavedApiKeyMask))
          }
          placeholder={providerDef?.credentialPlaceholder ?? "sk-… 或 Token"}
          disabled={busy}
          autoComplete="off"
        />
        {providerDef?.credentialHint ? (
          <p className={`mt-1.5 ${PANEL_TYPOGRAPHY.meta}`}>{providerDef.credentialHint}</p>
        ) : null}
      </label>
    </div>
  );
}
