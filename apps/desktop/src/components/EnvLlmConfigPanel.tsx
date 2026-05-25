import { useCallback, useEffect, useState } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY, CONTROL_TEXT_INPUT } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { EnvLlmCapabilitiesSection } from "./EnvLlmCapabilitiesSection";
import {
  DEFAULT_LLM_API_KEY_ID,
  LLM_PROVIDER_DEFINITIONS,
  applyLlmProviderPreset,
  getLlmProviderDefinition,
  isLlmRuntimeReady,
  llmConfigHint,
  persistLlmRuntimeConfig,
  readLlmRuntimeConfigFromStorage,
  setLlmApiKeyInMemory,
  type LlmProviderId,
  type PostprocessRuntimeBridge,
} from "../services/postprocess/postprocessRuntimeContract";
import { llmDeleteApiKey, llmProbeConnection, llmSaveApiKey } from "../tauri/postprocessApi";

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
  const [savedApiKeyId, setSavedApiKeyId] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [probeBusy, setProbeBusy] = useState(false);
  const [probeState, setProbeState] = useState<"idle" | "ok" | "fail">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const c = readLlmRuntimeConfigFromStorage();
    setProviderId(c.providerId);
    setBaseUrl(c.baseUrl);
    setModel(c.model);
    setSavedApiKeyId(c.apiKeyId ?? null);
  }, []);
  const def = getLlmProviderDefinition(providerId);
  const formBusy = busy || saveBusy || probeBusy;
  const ready = isLlmRuntimeReady();
  const onProviderChange = useCallback((next: LlmProviderId) => {
    setProviderId(next);
    const preset = applyLlmProviderPreset(next);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
    setProbeState("idle");
    setMsg(null);
  }, []);
  const buildProbeRuntime = useCallback((): PostprocessRuntimeBridge => {
    if (!def) throw new Error("未知的 LLM 厂商预设。");
    const typedApiKey = apiKey.trim();
    const runtime: PostprocessRuntimeBridge = {
      provider: def.label,
      base_url: baseUrl.trim() || def.defaultBaseUrl,
      model: model.trim() || def.defaultModel,
    };
    if (typedApiKey) runtime.api_key = typedApiKey;
    else if (savedApiKeyId) runtime.api_key_id = savedApiKeyId;
    const allowInsecureHttp =
      runtime.base_url.startsWith("http://127.0.0.1") || runtime.base_url.startsWith("http://localhost");
    if (allowInsecureHttp) runtime.allow_insecure_http = true;
    return runtime;
  }, [apiKey, baseUrl, def, model, savedApiKeyId]);
  const save = useCallback(async () => {
    setMsg(null);
    setProbeState("idle");
    setSaveBusy(true);
    try {
      const typedApiKey = apiKey.trim();
      let nextApiKeyId = savedApiKeyId ?? undefined;
      if (typedApiKey) {
        nextApiKeyId = await llmSaveApiKey({
          api_key_id: nextApiKeyId ?? DEFAULT_LLM_API_KEY_ID,
          api_key: typedApiKey,
        });
      }
      persistLlmRuntimeConfig({ providerId, baseUrl, model, apiKeyId: nextApiKeyId });
      setSavedApiKeyId(nextApiKeyId ?? null);
      setLlmApiKeyInMemory(null);
      if (typedApiKey) {
        setApiKey("");
        setMsg("已保存。API Key 已写入系统钥匙串；当前页面不再保留明文。");
      } else if (nextApiKeyId) {
        setMsg("已保存连接信息，将继续使用系统钥匙串中的 API Key。");
      } else {
        setMsg("已保存连接信息。请填写 API Key 并保存到系统钥匙串。");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }, [apiKey, baseUrl, model, providerId, savedApiKeyId]);
  const clearSavedApiKey = useCallback(async () => {
    if (!savedApiKeyId) return;
    setMsg(null);
    setProbeState("idle");
    setSaveBusy(true);
    try {
      await llmDeleteApiKey({ api_key_id: savedApiKeyId });
      persistLlmRuntimeConfig({ providerId, baseUrl, model });
      setSavedApiKeyId(null);
      setApiKey("");
      setLlmApiKeyInMemory(null);
      setMsg("已清除系统钥匙串中的 API Key。");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }, [baseUrl, model, providerId, savedApiKeyId]);
  const probe = useCallback(async () => {
    setMsg(null);
    setProbeBusy(true);
    try {
      const runtime = buildProbeRuntime();
      if (!runtime.api_key && !runtime.api_key_id) {
        throw new Error("请先填写 API Key，或使用已保存的系统钥匙串密钥。");
      }
      const out = await llmProbeConnection({ runtime });
      setProbeState(out.ok ? "ok" : "fail");
      setMsg(out.ok ? `连接成功（约 ${out.latency_ms ?? "?"} ms）。` : out.message);
    } catch (e) {
      setProbeState("fail");
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setProbeBusy(false);
    }
  }, [buildProbeRuntime]);
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
      <EnvLlmCapabilitiesSection />
      <section className="space-y-4">
        <div>
          <h4 className={PANEL_TYPOGRAPHY.sectionTitle}>连接</h4>
          <p className={PANEL_TYPOGRAPHY.meta}>
            选择厂商或填写兼容网关；模型 ID 以厂商控制台为准。
          </p>
        </div>

        <fieldset className="space-y-2" disabled={formBusy}>
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
            disabled={formBusy}
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
            disabled={formBusy}
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
            disabled={formBusy}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={savedApiKeyId ? "留空则沿用已保存的系统钥匙串密钥" : "在厂商控制台创建并保存到系统钥匙串"}
          />
          <span className={PANEL_TYPOGRAPHY.meta}>
            与在线 STT 密钥分开存放；不写入 localStorage 或项目文件。点击保存后将写入系统钥匙串，重启应用后仍可用。
          </span>
        </label>

        <p className={PANEL_TYPOGRAPHY.meta}>
          {savedApiKeyId
            ? `系统钥匙串：已保存 API Key（标识：${savedApiKeyId}）。输入框留空时将继续使用它。`
            : "系统钥匙串：当前未保存 API Key。"}
        </p>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={formBusy} onClick={() => void save()}>
            保存配置
          </button>
          <button type="button" className={btnSecondary} disabled={formBusy} onClick={() => void probe()}>
            {probeBusy ? "探测中…" : "探测连接"}
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={formBusy}
            onClick={() => onProviderChange(providerId)}
          >
            恢复厂商默认
          </button>
          <button type="button" className={btnSecondary} disabled={formBusy || !savedApiKeyId} onClick={() => void clearSavedApiKey()}>
            清除已保存 Key
          </button>
        </div>

        {msg ? <p className={PANEL_TYPOGRAPHY.meta}>{msg}</p> : null}
        {probeState !== "fail" && ready ? (
          <p className="text-[11px] text-zen-saffron">
            连接就绪：编辑器中的 LLM 能力（如自动标点）可使用当前配置。
          </p>
        ) : null}
        {!ready ? (
          <p className="text-[11px] text-zen-cinnabar">{llmConfigHint()}</p>
        ) : null}
      </section>
    </div>
  );
}
