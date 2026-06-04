import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY, CONTROL_TEXT_INPUT } from "../config/controlStyles";
import { ENV_EXTERNAL_LINK_CLASS } from "../config/envVendorChipStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import { llmKeychainReferenceMessage, normalizeLlmApiKeyId } from "../services/postprocess/postprocessRuntimeContract";
import type { useEnvLlmConfigPanel } from "../hooks/useEnvLlmConfigPanel";

const btnPrimary = CONTROL_BTN_PRIMARY;
const btnSecondary = CONTROL_BTN_SECONDARY;
const field = CONTROL_TEXT_INPUT;
const fieldLabel = PANEL_TYPOGRAPHY.envFieldLabel;
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
  return (
    <div className="py-5">
      <div className="space-y-5">
        <label className="block space-y-2">
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

        <label className="block space-y-2">
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
            本机 Ollama 不需要 API Key。模型 ID 须与{" "}
            <code className={PANEL_TYPOGRAPHY.code}>ollama list</code> 一致（推荐 qwen2.5:7b）。
          </p>
        ) : (
          <>
            <label className="block space-y-2">
              <span className={fieldLabel}>API Key</span>
              <input
                className={monoField}
                type="password"
                autoComplete="off"
                aria-label="API Key"
                value={props.apiKey}
                disabled={props.formBusy}
                onChange={(e) => {
                  props.invalidateProbe();
                  props.setApiKey(e.target.value);
                }}
                placeholder={
                  props.savedApiKeyId ? "留空则沿用已保存的本地密钥" : "在厂商控制台创建并保存到本地安全存储"
                }
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

      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-notion-divider pt-5">
        <button
          type="button"
          className={`${btnSecondary} mr-auto text-notion-text-muted`}
          disabled={props.formBusy}
          onClick={() => props.onProviderChange(props.providerId)}
        >
          恢复厂商默认
        </button>
        {!props.localLoopback ? (
          <button
            type="button"
            className={btnSecondary}
            disabled={props.formBusy || !props.savedApiKeyId}
            onClick={() => void props.clearSavedApiKey()}
          >
            清除已保存 Key
          </button>
        ) : null}
        <button type="button" className={btnPrimary} disabled={props.formBusy} onClick={() => void props.save()}>
          保存配置
        </button>
      </div>
    </div>
  );
}
