import {
  CONTROL_TEXT_INPUT,
  ENV_MONO_FIELD,
} from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { ENV_PANEL_FORM_FIELD_CLASS } from "../../utils/environmentPanelNav";
import {
  XUNFEI_SPEED_ASR_ACCENT_PRESETS,
} from "../../services/stt/sttOnlineProviderContract/xunfeiAccentPresets";
import type { SttOnlineProviderDefinition } from "../../services/stt/sttOnlineProviderContract";
import {
  isSavedApiKeyMaskDisplayed,
  normalizeSavedApiKeyInputChange,
  resolveSavedApiKeyInputDisplay,
  shouldClearSavedKeyFromMaskInput,
} from "../../services/secrets/savedApiKeyInput";

const fieldLabel = PANEL_TYPOGRAPHY.envFieldLabel;
const fieldGroup = ENV_PANEL_FORM_FIELD_CLASS;
const monoField = `${CONTROL_TEXT_INPUT} ${ENV_MONO_FIELD}`;

type Props = {
  busy: boolean;
  providerId: string;
  providerDef: SttOnlineProviderDefinition | null;
  appKey: string;
  apiKey: string;
  apiSecret: string;
  accent: string;
  savedApiKeyId: string | null;
  savedApiSecretId: string | null;
  keychainResolved: boolean | null;
  onAppKeyChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onApiSecretChange: (value: string) => void;
  onAccentChange: (value: string) => void;
  onClearSavedApiKey: () => void;
};

export function OnlineSttRuntimeCredentialFields({
  busy,
  providerId,
  providerDef,
  appKey,
  apiKey,
  apiSecret,
  accent,
  savedApiKeyId,
  savedApiSecretId,
  keychainResolved,
  onAppKeyChange,
  onApiKeyChange,
  onApiSecretChange,
  onAccentChange,
  onClearSavedApiKey,
}: Props) {
  const showSavedApiKeyMask = isSavedApiKeyMaskDisplayed(apiKey, savedApiKeyId, keychainResolved);
  const apiKeyDisplay = resolveSavedApiKeyInputDisplay({
    typedApiKey: apiKey,
    savedApiKeyId,
    keychainReady: keychainResolved,
  });
  const showSavedApiSecretMask = isSavedApiKeyMaskDisplayed(
    apiSecret,
    savedApiSecretId,
    keychainResolved,
  );
  const apiSecretDisplay = resolveSavedApiKeyInputDisplay({
    typedApiKey: apiSecret,
    savedApiKeyId: savedApiSecretId,
    keychainReady: keychainResolved,
  });

  return (
    <>
      {providerDef?.requiresPersistedAppKey ? (
        <label className={fieldGroup}>
          <span className={fieldLabel}>{providerDef.persistedAppKeyFieldLabel ?? "应用标识（可持久化）"}</span>
          <input
            type="text"
            className={monoField}
            value={appKey}
            onChange={(e) => onAppKeyChange(e.target.value)}
            placeholder="与控制台一致，保存在本机配置"
            disabled={busy}
            autoComplete="off"
          />
          {providerDef.requiresApiSecret ? (
            <p className={PANEL_TYPOGRAPHY.meta}>
              讯飞控制台三项须全部填写并保存：
              <span className="font-medium text-notion-text"> AppID、APISecret、APIKey</span>
              。
            </p>
          ) : null}
        </label>
      ) : null}

      {providerDef?.requiresApiSecret ? (
        <label className={fieldGroup}>
          <span className={fieldLabel}>APISecret</span>
          <input
            type="password"
            className={monoField}
            value={apiSecretDisplay}
            onFocus={(e) => {
              if (showSavedApiSecretMask) e.currentTarget.select();
            }}
            onChange={(e) => {
              const next = normalizeSavedApiKeyInputChange(e.target.value, showSavedApiSecretMask);
              if (shouldClearSavedKeyFromMaskInput(showSavedApiSecretMask, next)) {
                onClearSavedApiKey();
                return;
              }
              onApiSecretChange(next);
            }}
            placeholder="控制台 APISecret"
            disabled={busy}
            autoComplete="off"
          />
          <p className={PANEL_TYPOGRAPHY.meta}>与 APIKey 配对；保存后写入本机密钥存储。</p>
        </label>
      ) : null}

      <label className={fieldGroup}>
        <span className={fieldLabel}>
          {providerDef?.credentialFieldLabel ??
            (providerDef?.authStyle === "header" && providerDef.headerName
              ? `根凭证 / 令牌（HTTP 头 ${providerDef.headerName}）`
              : "根凭证 / API 密钥")}
        </span>
        <input
          type="password"
          className={monoField}
          value={apiKeyDisplay}
          onFocus={(e) => {
            if (showSavedApiKeyMask) e.currentTarget.select();
          }}
          onChange={(e) => {
            const next = normalizeSavedApiKeyInputChange(e.target.value, showSavedApiKeyMask);
            if (shouldClearSavedKeyFromMaskInput(showSavedApiKeyMask, next)) {
              onClearSavedApiKey();
              return;
            }
            onApiKeyChange(next);
          }}
          placeholder={providerDef?.credentialPlaceholder ?? "sk-… 或 Token"}
          disabled={busy}
          autoComplete="off"
        />
        {providerDef?.credentialHint ? (
          <p className={PANEL_TYPOGRAPHY.meta}>{providerDef.credentialHint}</p>
        ) : null}
      </label>

      {providerId === "iflytek-speed-asr" ? (
        <label className={fieldGroup}>
          <span className={fieldLabel}>口音 / 方言</span>
          {XUNFEI_SPEED_ASR_ACCENT_PRESETS.length > 1 ? (
            <select
              className={CONTROL_TEXT_INPUT}
              value={accent}
              onChange={(e) => onAccentChange(e.target.value)}
              disabled={busy}
            >
              {XUNFEI_SPEED_ASR_ACCENT_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          ) : (
            <p className={PANEL_TYPOGRAPHY.meta}>
              普通话（zh_cn 自动识别中英 + 202 种方言，无需手动选择）
            </p>
          )}
        </label>
      ) : null}
    </>
  );
}
