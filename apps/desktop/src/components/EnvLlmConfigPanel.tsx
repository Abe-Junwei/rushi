import { useCallback, useEffect, useState } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY, CONTROL_TEXT_INPUT } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  LLM_CAPABILITIES,
  LLM_PROVIDER_DEFINITIONS,
  applyLlmProviderPreset,
  getLlmProviderDefinition,
  isLlmRuntimeReady,
  llmConfigHint,
  persistLlmRuntimeConfig,
  readLlmRuntimeConfigFromStorage,
  setLlmApiKeyInMemory,
  type LlmProviderId,
} from "../services/postprocess/postprocessRuntimeContract";

const btnPrimary = CONTROL_BTN_PRIMARY;
const btnSecondary = CONTROL_BTN_SECONDARY;
const field = CONTROL_TEXT_INPUT;

type Props = {
  busy: boolean;
};

export function EnvLlmConfigPanel({ busy }: Props) {
  const [providerId, setProviderId] = useState<LlmProviderId>("deepseek");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const c = readLlmRuntimeConfigFromStorage();
    setProviderId(c.providerId);
    setBaseUrl(c.baseUrl);
    setModel(c.model);
  }, []);

  const def = getLlmProviderDefinition(providerId);
  const ready = isLlmRuntimeReady();

  const onProviderChange = useCallback((next: LlmProviderId) => {
    setProviderId(next);
    const preset = applyLlmProviderPreset(next);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
    setMsg(null);
  }, []);

  const save = useCallback(() => {
    setMsg(null);
    try {
      persistLlmRuntimeConfig({ providerId, baseUrl, model });
      setLlmApiKeyInMemory(apiKey.trim() || null);
      setMsg(
        isLlmRuntimeReady()
          ? "已保存。API Key 仅保留在当前应用会话内存；关闭应用后需重新填写。"
          : "已保存连接信息。请填写 API Key 后再次点击保存。",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }, [apiKey, baseUrl, model, providerId]);

  return (
    <div id="llm-config" className="flex max-w-2xl flex-col gap-6">
      <header className="space-y-2">
        <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>LLM 配置</h3>
        <p className={PANEL_TYPOGRAPHY.sectionDescription}>
          统一管理桌面端使用的<strong className="font-medium text-notion-text">远程文本大模型</strong>
          （OpenAI 兼容 <code className={PANEL_TYPOGRAPHY.code}>/v1/chat/completions</code>
          ）。转写仍走本机 ASR / 在线 STT，与此处配置无关。
        </p>
        <p className={PANEL_TYPOGRAPHY.body}>
          请求由应用壳（Tauri）直连厂商，语段正文仅在触发具体能力时发送；不会静默改写文稿。后续智能分段、文本规整等能力将共用本页连接信息。
        </p>
      </header>

      <section className="space-y-2 rounded-lg bg-notion-sidebar/60 px-3 py-3">
        <h4 className={PANEL_TYPOGRAPHY.sectionTitle}>已接入能力</h4>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {LLM_CAPABILITIES.map((cap) => (
            <li
              key={cap.id}
              className="flex flex-col gap-0.5 rounded-md bg-white/80 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-medium text-notion-text">{cap.label}</span>
                <span className="rounded bg-zen-saffron/15 px-1.5 py-0.5 text-[10px] font-semibold text-zen-saffron">
                  可用
                </span>
              </div>
              <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{cap.description}</p>
            </li>
          ))}
        </ul>
        <p className={`m-0 ${PANEL_TYPOGRAPHY.helper}`}>
          更多 LLM 能力将在此列出；连接与密钥保持一处配置，避免重复填写。
        </p>
      </section>

      <section className="space-y-4">
        <div>
          <h4 className={PANEL_TYPOGRAPHY.sectionTitle}>连接</h4>
          <p className={PANEL_TYPOGRAPHY.meta}>
            选择厂商或填写兼容网关；模型 ID 以厂商控制台为准。
          </p>
        </div>

        <fieldset className="space-y-2" disabled={busy}>
          <legend className={PANEL_TYPOGRAPHY.fieldLabel}>厂商预设</legend>
          <div className="flex flex-wrap gap-2">
            {LLM_PROVIDER_DEFINITIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={[
                  "rounded-md border px-3 py-1.5 text-[12px] transition-colors",
                  providerId === p.id
                    ? "border-zen-saffron/50 bg-zen-saffron/10 text-notion-text"
                    : "border-notion-divider bg-white text-notion-text-muted hover:bg-notion-sidebar-hover",
                ].join(" ")}
                onClick={() => onProviderChange(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {def ? (
            <p className={PANEL_TYPOGRAPHY.meta}>
              {def.description}{" "}
              <a
                href={def.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-zen-saffron underline-offset-2 hover:underline"
              >
                开放平台文档
              </a>
            </p>
          ) : null}
        </fieldset>

        <label className="block space-y-1">
          <span className={PANEL_TYPOGRAPHY.fieldLabel}>API 基址</span>
          <input
            className={field}
            value={baseUrl}
            disabled={busy}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={def?.defaultBaseUrl}
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
            value={model}
            disabled={busy}
            onChange={(e) => setModel(e.target.value)}
            placeholder={def?.defaultModel}
            list="llm-model-suggestions"
          />
          <datalist id="llm-model-suggestions">
            {def?.modelExamples.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        <label className="block space-y-1">
          <span className={PANEL_TYPOGRAPHY.fieldLabel}>API Key</span>
          <input
            className={field}
            type="password"
            autoComplete="off"
            value={apiKey}
            disabled={busy}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="在厂商控制台创建，仅当前会话有效"
          />
          <span className={PANEL_TYPOGRAPHY.meta}>
            与在线 STT 密钥分开存放；不写入 localStorage 或项目文件。重启应用后需重新填写（后续版本可支持钥匙串）。
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={busy} onClick={save}>
            保存配置
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={busy}
            onClick={() => onProviderChange(providerId)}
          >
            恢复厂商默认
          </button>
        </div>

        {msg ? <p className={PANEL_TYPOGRAPHY.meta}>{msg}</p> : null}
        {ready ? (
          <p className="text-[11px] text-zen-saffron">
            连接就绪：编辑器中的 LLM 能力（如自动标点）可使用当前配置。
          </p>
        ) : (
          <p className="text-[11px] text-zen-cinnabar">{llmConfigHint()}</p>
        )}
      </section>
    </div>
  );
}
