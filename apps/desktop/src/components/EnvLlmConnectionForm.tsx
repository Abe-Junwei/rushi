import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY, CONTROL_TEXT_INPUT } from "../config/controlStyles";
import { ENV_EXTERNAL_LINK_CLASS } from "../config/envVendorChipStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import {
  ENV_PANEL_ACTION_ROW_CLASS,
  ENV_PANEL_FORM_CLASS,
  ENV_PANEL_FORM_FIELDS_CLASS,
  ENV_PANEL_FORM_FIELD_CLASS,
} from "../utils/environmentPanelNav";
import { llmKeychainReferenceMessage, normalizeLlmApiKeyId } from "../services/postprocess/postprocessRuntimeContract";
import {
  isSavedApiKeyMaskDisplayed,
  normalizeSavedApiKeyInputChange,
  resolveSavedApiKeyInputDisplay,
  shouldClearSavedKeyFromMaskInput,
} from "../services/secrets/savedApiKeyInput";
import type { useEnvLlmConfigPanel } from "../hooks/useEnvLlmConfigPanel";

const field = CONTROL_TEXT_INPUT;
const fieldLabel = PANEL_TYPOGRAPHY.envFieldLabel;
const fieldGroup = ENV_PANEL_FORM_FIELD_CLASS;
const monoField = `${field} ${PANEL_CONTROL_TYPOGRAPHY.compactTechnicalInput}`;

type PanelState = ReturnType<typeof useEnvLlmConfigPanel>;

type Props = Pick<
  PanelState,
  | "llmEnvMode"
  | "formBusy"
  | "localLoopback"
  | "providerId"
  | "baseUrl"
  | "model"
  | "apiKey"
  | "savedApiKeyId"
  | "def"
  | "onProviderChange"
  | "setBaseUrl"
  | "setModel"
  | "setApiKey"
  | "invalidateProbe"
  | "save"
  | "clearSavedApiKey"
  | "keychainChecking"
  | "keychainReady"
>;

export function EnvLlmConnectionForm(props: Props) {
  const showSavedApiKeyMask = isSavedApiKeyMaskDisplayed(
    props.apiKey,
    props.savedApiKeyId,
    props.keychainChecking ? null : props.keychainReady,
  );
  const apiKeyDisplay = resolveSavedApiKeyInputDisplay({
    typedApiKey: props.apiKey,
    savedApiKeyId: props.savedApiKeyId,
    keychainReady: props.keychainChecking ? null : props.keychainReady,
  });

  return (
    <div className={ENV_PANEL_FORM_CLASS}>
      <div className={ENV_PANEL_FORM_FIELDS_CLASS}>
        <label className={fieldGroup}>
          <span className={fieldLabel}>API 基址</span>
          <input
            className={monoField}
            value={props.baseUrl}
            disabled={props.formBusy}
            onChange={(e) => {
              props.invalidateProbe();
              props.setBaseUrl(e.target.value);
            }}
            placeholder={props.def?.defaultBaseUrl}
            aria-describedby={props.localLoopback ? "llm-base-url-hint" : undefined}
          />
          {props.localLoopback ? (
            <span id="llm-base-url-hint" className={PANEL_TYPOGRAPHY.meta}>
              须为 HTTPS；本地调试可用 <code className={PANEL_TYPOGRAPHY.code}>http://127.0.0.1</code> 或{" "}
              <code className={PANEL_TYPOGRAPHY.code}>localhost</code>。
            </span>
          ) : null}
        </label>

        <label className={fieldGroup}>
          <span className={fieldLabel}>模型 ID</span>
          <input
            className={monoField}
            value={props.model}
            disabled={props.formBusy}
            onChange={(e) => {
              props.invalidateProbe();
              props.setModel(e.target.value);
            }}
            placeholder={props.def?.defaultModel}
            list="llm-model-suggestions"
          />
          <datalist id="llm-model-suggestions">
            {props.def?.modelExamples.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        {props.localLoopback ? (
          <p className={PANEL_TYPOGRAPHY.meta}>
            本机 Ollama 不需要 API 密钥。模型 ID 须与{" "}
            <code className={PANEL_TYPOGRAPHY.code}>ollama list</code> 一致（推荐 qwen2.5:7b）。
          </p>
        ) : (
          <>
            <label className={fieldGroup}>
              <span className={fieldLabel}>API 密钥</span>
              <input
                className={monoField}
                type="password"
                autoComplete="off"
                aria-label="API 密钥"
                value={apiKeyDisplay}
                disabled={props.formBusy}
                onFocus={(e) => {
                  if (showSavedApiKeyMask) e.currentTarget.select();
                }}
                onChange={(e) => {
                  props.invalidateProbe();
                  const next = normalizeSavedApiKeyInputChange(e.target.value, showSavedApiKeyMask);
                  if (shouldClearSavedKeyFromMaskInput(showSavedApiKeyMask, next)) {
                    void props.clearSavedApiKey();
                    return;
                  }
                  props.setApiKey(next);
                }}
                placeholder="控制台创建后粘贴保存"
              />
            </label>

            <p className={PANEL_TYPOGRAPHY.meta}>
              {llmKeychainReferenceMessage(
                normalizeLlmApiKeyId(props.savedApiKeyId) ?? null,
                props.keychainChecking ? null : props.keychainReady,
              )}
            </p>

            {props.def ? (
              <p className={PANEL_TYPOGRAPHY.meta}>
                {props.def.description}{" "}
                <a
                  href={props.def.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={ENV_EXTERNAL_LINK_CLASS}
                >
                  开放平台文档
                </a>
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className={ENV_PANEL_ACTION_ROW_CLASS}>
        <button
          type="button"
          className={`${CONTROL_BTN_SECONDARY} mr-auto text-notion-text-muted`}
          disabled={props.formBusy}
          onClick={() => props.onProviderChange(props.providerId)}
        >
          恢复厂商默认
        </button>
        {!props.localLoopback ? (
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={props.formBusy || !props.savedApiKeyId}
            onClick={() => void props.clearSavedApiKey()}
          >
            清除已保存密钥
          </button>
        ) : null}
        <button type="button" className={CONTROL_BTN_PRIMARY} disabled={props.formBusy} onClick={() => void props.save()}>
          保存配置
        </button>
      </div>
    </div>
  );
}
