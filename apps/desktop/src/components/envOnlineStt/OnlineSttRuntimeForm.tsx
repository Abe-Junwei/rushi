import {
  IconInfoCircle as Info,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import {
  CONTROL_BTN_PRIMARY,
  CONTROL_BTN_SECONDARY,
  CONTROL_TEXT_INPUT,
  ENV_MONO_FIELD,
} from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import {
  ENV_PANEL_ACTION_ROW_CLASS,
  ENV_PANEL_FORM_CLASS,
  ENV_PANEL_FORM_FIELDS_CLASS,
  ENV_PANEL_FORM_FIELD_CLASS,
} from "../../utils/environmentPanelNav";
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
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { OnlineSttRuntimeCredentialFields } from "./OnlineSttRuntimeCredentialFields";

const fieldLabel = PANEL_TYPOGRAPHY.envFieldLabel;
const fieldGroup = ENV_PANEL_FORM_FIELD_CLASS;
const monoField = `${CONTROL_TEXT_INPUT} ${ENV_MONO_FIELD}`;
const presetEndpointDisplay =
  "break-all rounded-sm border border-notion-border bg-notion-bg-secondary/60 px-3 py-2 font-mono text-label font-normal normal-case leading-relaxed text-notion-text-muted";

type Props = {
  busy: boolean;
  providerId: string;
  providerDef: SttOnlineProviderDefinition | null;
  endpoint: string;
  timeoutSec: number;
  appKey: string;
  apiKey: string;
  apiSecret: string;
  accent: string;
  savedApiKeyId: string | null;
  savedApiSecretId: string | null;
  keychainChecking?: boolean;
  keychainReady?: boolean | null;
  onEndpointChange: (value: string) => void;
  onTimeoutSecChange: (value: number) => void;
  onAppKeyChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onApiSecretChange: (value: string) => void;
  onAccentChange: (value: string) => void;
  onClearSavedApiKey: () => void;
  onSave: () => void;
};

export function OnlineSttRuntimeForm({
  busy,
  providerId,
  providerDef,
  endpoint,
  timeoutSec,
  appKey,
  apiKey,
  apiSecret,
  accent,
  savedApiKeyId,
  savedApiSecretId,
  keychainChecking = false,
  keychainReady = null,
  onEndpointChange,
  onTimeoutSecChange,
  onAppKeyChange,
  onApiKeyChange,
  onApiSecretChange,
  onAccentChange,
  onClearSavedApiKey,
  onSave,
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
      : "标准令牌认证 / API 密钥";
  const presetDisplay = resolveSttOnlinePresetEndpointDisplay(providerId);
  const showCustomEndpoint = sttOnlineProviderEndpointUserConfigurable(providerId);
  const keychainResolved = keychainChecking ? null : keychainReady;

  return (
    <div className={ENV_PANEL_FORM_CLASS}>
      <div className={ENV_PANEL_FORM_FIELDS_CLASS}>
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
          当前厂商：<span className="font-medium text-notion-text">{providerLabel}</span>
          {" · "}
          鉴权：<span className="font-medium text-notion-text">{authSummary}</span>
        </p>

      {showCustomEndpoint ? (
        <label className={fieldGroup}>
          <span className={fieldLabel}>转写 POST 完整 URL</span>
          <input
            type="url"
            className={monoField}
            value={endpoint}
            onChange={(e) => onEndpointChange(e.target.value)}
            placeholder="https://你的网关/v1/transcribe"
            disabled={busy}
            autoComplete="off"
          />
        </label>
      ) : presetDisplay ? (
        <div className={fieldGroup}>
          <span className={fieldLabel}>预置转写端点</span>
          <p className={`m-0 ${presetEndpointDisplay}`} title={presetDisplay} aria-readonly>
            {presetDisplay}
          </p>
          <p className={`flex items-center gap-1 ${PANEL_TYPOGRAPHY.meta}`}>
            <Info className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            无需填 URL，保存凭证即可。
          </p>
        </div>
      ) : null}

      <label className={fieldGroup}>
        <span className={fieldLabel}>
          超时（秒，{STT_ONLINE_TIMEOUT_SEC_MIN}–{STT_ONLINE_TIMEOUT_SEC_MAX}）
        </span>
        <input
          type="number"
          min={STT_ONLINE_TIMEOUT_SEC_MIN}
          max={STT_ONLINE_TIMEOUT_SEC_MAX}
          step={1}
          inputMode="numeric"
          className={CONTROL_TEXT_INPUT}
          value={timeoutInput}
          onChange={(e) => setTimeoutInput(e.target.value)}
          onBlur={commitTimeoutInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          disabled={busy}
        />
        <p className={PANEL_TYPOGRAPHY.meta}>
          修改后需点击「保存在线配置」或「探测连接」才会用于转写。
        </p>
      </label>

      <OnlineSttRuntimeCredentialFields
        busy={busy}
        providerId={providerId}
        providerDef={providerDef}
        appKey={appKey}
        apiKey={apiKey}
        apiSecret={apiSecret}
        accent={accent}
        savedApiKeyId={savedApiKeyId}
        savedApiSecretId={savedApiSecretId}
        keychainResolved={keychainResolved}
        onAppKeyChange={onAppKeyChange}
        onApiKeyChange={onApiKeyChange}
        onApiSecretChange={onApiSecretChange}
        onAccentChange={onAccentChange}
        onClearSavedApiKey={onClearSavedApiKey}
      />
      </div>

      <div className={ENV_PANEL_ACTION_ROW_CLASS}>
        <button
          type="button"
          className={`${CONTROL_BTN_SECONDARY} mr-auto text-notion-text-muted`}
          disabled={busy || (!savedApiKeyId && !savedApiSecretId)}
          onClick={onClearSavedApiKey}
        >
          清除已保存密钥
        </button>
        <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onSave}>
          保存在线配置
        </button>
      </div>
    </div>
  );
}
