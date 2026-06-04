import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY, CONTROL_TEXT_INPUT } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { LLM_PROVIDER_DEFINITIONS, llmKeychainReferenceMessage, normalizeLlmApiKeyId } from "../services/postprocess/postprocessRuntimeContract";
import { cloudLlmProviderIds } from "./EnvLlmModeSwitch";
import type { useEnvLlmConfigPanel } from "../hooks/useEnvLlmConfigPanel";

const btnPrimary = CONTROL_BTN_PRIMARY;
const btnSecondary = CONTROL_BTN_SECONDARY;
const field = CONTROL_TEXT_INPUT;

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
  | "probeBusy"
  | "probeFailed"
  | "msg"
  | "onProviderChange"
  | "setBaseUrl"
  | "setModel"
  | "setApiKey"
  | "invalidateProbe"
  | "save"
  | "probe"
  | "clearSavedApiKey"
  | "keychainChecking"
  | "keychainReady"
>;

export function EnvLlmConnectionForm(props: Props) {
  const cloudProviderIds = cloudLlmProviderIds();

  return (
    <section className="space-y-4">
      <div>
        <h4 className={PANEL_TYPOGRAPHY.sectionTitle}>连接</h4>
        <p className={PANEL_TYPOGRAPHY.meta}>
          {props.llmEnvMode === "local"
            ? "确认模型 ID 与 ollama list 一致，保存后点击探测连接。"
            : "选择云端厂商或填写兼容网关；模型 ID 以厂商控制台为准。"}
        </p>
      </div>

      {props.llmEnvMode === "cloud" ? (
        <fieldset className="space-y-2" disabled={props.formBusy}>
          <legend className={PANEL_TYPOGRAPHY.fieldLabel}>云端厂商</legend>
          <div className="flex flex-wrap gap-2">
            {LLM_PROVIDER_DEFINITIONS.filter((p) => cloudProviderIds.includes(p.id)).map((p) => (
              <button
                key={p.id}
                type="button"
                className={[
                  "rounded-md border px-3 py-1.5 text-[12px] transition-colors",
                  props.providerId === p.id
                    ? "border-zen-saffron/50 bg-zen-saffron/10 text-notion-text"
                    : "border-notion-divider bg-white text-notion-text-muted hover:bg-notion-sidebar-hover",
                ].join(" ")}
                onClick={() => props.onProviderChange(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {props.def ? (
            <p className={PANEL_TYPOGRAPHY.meta}>
              {props.def.description}{" "}
              <a
                href={props.def.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-zen-saffron underline-offset-2 hover:underline"
              >
                开放平台文档
              </a>
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <label className="block space-y-1">
        <span className={PANEL_TYPOGRAPHY.fieldLabel}>API 基址</span>
        <input
          className={field}
          value={props.baseUrl}
          disabled={props.formBusy}
          onChange={(e) => {
            props.invalidateProbe();
            props.setBaseUrl(e.target.value);
          }}
          placeholder={props.def?.defaultBaseUrl}
          aria-describedby="llm-base-url-hint"
        />
        <span id="llm-base-url-hint" className={PANEL_TYPOGRAPHY.meta}>
          须为 HTTPS；本地调试可用 <code className={PANEL_TYPOGRAPHY.code}>http://127.0.0.1</code> 或{" "}
          <code className={PANEL_TYPOGRAPHY.code}>localhost</code>。
        </span>
      </label>

      <label className="block space-y-1">
        <span className={PANEL_TYPOGRAPHY.fieldLabel}>模型 ID</span>
        <input
          className={field}
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
          本机 Ollama 不需要 API Key。请确认上方「本机 LLM」检测为就绪，模型 ID 与{" "}
          <code className={PANEL_TYPOGRAPHY.code}>ollama list</code> 中名称一致（推荐 qwen2.5:7b）。
        </p>
      ) : (
        <>
          <label className="block space-y-1">
            <span className={PANEL_TYPOGRAPHY.fieldLabel}>API Key</span>
            <input
              className={field}
              type="password"
              autoComplete="off"
              aria-label="API Key"
              value={props.apiKey}
              disabled={props.formBusy}
              onChange={(e) => {
                props.invalidateProbe();
                props.setApiKey(e.target.value);
              }}
              placeholder={props.savedApiKeyId ? "留空则沿用已保存的本地密钥" : "在厂商控制台创建并保存到本地安全存储"}
            />
            <span className={PANEL_TYPOGRAPHY.meta}>
              与在线 STT 密钥分开存放；不写入 localStorage 或项目文件。macOS 默认保存到应用数据目录受保护文件；Windows 优先系统凭据管理器。
            </span>
          </label>

          <p className={PANEL_TYPOGRAPHY.meta}>
            {llmKeychainReferenceMessage(
              normalizeLlmApiKeyId(props.savedApiKeyId) ?? null,
              props.keychainChecking ? null : props.keychainReady,
            )}
          </p>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnPrimary} disabled={props.formBusy} onClick={() => void props.save()}>
          保存配置
        </button>
        <button type="button" className={btnSecondary} disabled={props.formBusy} onClick={() => void props.probe()}>
          {props.probeBusy ? "探测中…" : "探测连接"}
        </button>
        <button
          type="button"
          className={btnSecondary}
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
      </div>

      {props.msg ? (
        <p
          className={[
            PANEL_TYPOGRAPHY.meta,
            props.probeFailed ? "text-zen-cinnabar" : "",
          ].join(" ")}
        >
          {props.msg}
        </p>
      ) : null}
    </section>
  );
}
