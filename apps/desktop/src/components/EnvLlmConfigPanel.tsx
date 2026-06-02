import { useCallback, useEffect, useMemo, useState } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY, CONTROL_TEXT_INPUT } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { useLlmKeychainReady } from "../hooks/useLlmKeychainReady";
import { EnvLlmCapabilitiesSection } from "./EnvLlmCapabilitiesSection";
import {
  DEFAULT_LLM_API_KEY_ID,
  LLM_PROVIDER_DEFINITIONS,
  LLM_STORAGE_KEYS,
  applyLlmProviderPreset,
  getLlmProviderDefinition,
  isCorruptLlmApiKeyId,
  isLlmConnectionVerified,
  isLlmRuntimeReady,
  LLM_CONNECTION_VERIFIED_EVENT,
  llmConnectionStatusMessage,
  llmConnectionStatusTone,
  llmKeychainReferenceMessage,
  markLlmConnectionVerified,
  normalizeLlmApiKeyId,
  persistLlmRuntimeConfig,
  readLlmRuntimeConfigFromStorage,
  resolveLlmConnectionUiStatus,
  setLlmApiKeyInMemory,
  tryBuildPostprocessRuntimeBridge,
  validateLlmConnectionDraft,
  type LlmProviderId,
  type PostprocessRuntimeBridge,
} from "../services/postprocess/postprocessRuntimeContract";
import { llmDeleteApiKey, llmMigrateLegacyApiKey, llmProbeConnection, llmSaveApiKey } from "../tauri/postprocessApi";

const btnPrimary = CONTROL_BTN_PRIMARY;
const btnSecondary = CONTROL_BTN_SECONDARY;
const field = CONTROL_TEXT_INPUT;

type Props = {
  busy: boolean;
  onLlmRuntimeChanged?: () => void;
};

export function EnvLlmConfigPanel({ busy, onLlmRuntimeChanged }: Props) {
  const [providerId, setProviderId] = useState<LlmProviderId>("deepseek");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [savedApiKeyId, setSavedApiKeyId] = useState<string | null>(null);
  /** 旧版误把 sk- 密钥写进 apiKeyId 字段时的原始值，用于迁移/清理。 */
  const [legacyMisplacedKeyId, setLegacyMisplacedKeyId] = useState<string | undefined>(undefined);
  const [saveBusy, setSaveBusy] = useState(false);
  const [probeBusy, setProbeBusy] = useState(false);
  const [probeState, setProbeState] = useState<"idle" | "ok" | "fail">(() =>
    isLlmConnectionVerified() ? "ok" : "idle",
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [keychainRefreshSeq, setKeychainRefreshSeq] = useState(0);

  useEffect(() => {
    const rawApiKeyId = (localStorage.getItem(LLM_STORAGE_KEYS.apiKeyId) ?? "").trim();
    const legacyId =
      rawApiKeyId && isCorruptLlmApiKeyId(rawApiKeyId) ? rawApiKeyId : undefined;
    setLegacyMisplacedKeyId(legacyId);
    const c = readLlmRuntimeConfigFromStorage();
    setProviderId(c.providerId);
    setBaseUrl(c.baseUrl);
    setModel(c.model);
    setSavedApiKeyId(c.apiKeyId ?? null);
    if (legacyId) {
      void llmMigrateLegacyApiKey({ legacyApiKeyId: legacyId })
        .then((migrated) => {
          if (migrated) setKeychainRefreshSeq((n) => n + 1);
        })
        .catch(() => {
          /* ignore migration errors; user can re-save key */
        });
    } else {
      setKeychainRefreshSeq((n) => n + 1);
    }
  }, []);
  useEffect(() => {
    const syncVerified = () => {
      if (isLlmConnectionVerified()) setProbeState("ok");
    };
    syncVerified();
    window.addEventListener(LLM_CONNECTION_VERIFIED_EVENT, syncVerified);
    return () => window.removeEventListener(LLM_CONNECTION_VERIFIED_EVENT, syncVerified);
  }, []);
  const def = getLlmProviderDefinition(providerId);
  const formBusy = busy || saveBusy || probeBusy;
  const hasLocalKeyRef = isLlmRuntimeReady();
  const { keychainReady, checking: keychainChecking } = useLlmKeychainReady(keychainRefreshSeq);
  const connectionStatus = useMemo(
    () =>
      resolveLlmConnectionUiStatus({
        hasLocalKeyRef,
        hasTypedKey: apiKey.trim().length > 0,
        keychainPresent: keychainChecking ? null : keychainReady,
        probeState,
      }),
    [apiKey, hasLocalKeyRef, keychainChecking, keychainReady, probeState],
  );
  const connectionStatusMessage = llmConnectionStatusMessage(connectionStatus);
  const connectionStatusTone = llmConnectionStatusTone(connectionStatus);
  const bumpKeychainCheck = useCallback(() => {
    setKeychainRefreshSeq((n) => n + 1);
  }, []);
  const invalidateProbe = useCallback(() => {
    setProbeState("idle");
  }, []);
  const onProviderChange = useCallback((next: LlmProviderId) => {
    setProviderId(next);
    const preset = applyLlmProviderPreset(next);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
    setProbeState("idle");
    setMsg(null);
  }, []);
  const buildProbeRuntime = useCallback((): PostprocessRuntimeBridge => {
    const typedApiKey = apiKey.trim();
    if (typedApiKey) {
      if (!def) throw new Error("未知的 LLM 厂商预设。");
      const stored = readLlmRuntimeConfigFromStorage();
      const resolvedBaseUrl = baseUrl.trim() || stored.baseUrl || def.defaultBaseUrl;
      const runtime: PostprocessRuntimeBridge = {
        provider: def.label,
        baseUrl: resolvedBaseUrl,
        model: model.trim() || stored.model || def.defaultModel,
        apiKey: typedApiKey,
      };
      if (
        resolvedBaseUrl.startsWith("http://127.0.0.1") ||
        resolvedBaseUrl.startsWith("http://localhost")
      ) {
        runtime.allowInsecureHttp = true;
      }
      return runtime;
    }
    const bridge = tryBuildPostprocessRuntimeBridge();
    if (!bridge) {
      throw new Error("请先填写 API Key，或使用已保存的本地密钥。");
    }
    return bridge;
  }, [apiKey, baseUrl, def, model]);
  const save = useCallback(async () => {
    setMsg(null);
    setProbeState("idle");
    setSaveBusy(true);
    try {
      validateLlmConnectionDraft({ providerId, baseUrl, model });
      const typedApiKey = apiKey.trim();
      const rawStoredKeyId = savedApiKeyId ?? readLlmRuntimeConfigFromStorage().apiKeyId ?? undefined;
      const misplacedKeyId = legacyMisplacedKeyId;
      let nextApiKeyId = normalizeLlmApiKeyId(rawStoredKeyId);
      if (typedApiKey) {
        if (misplacedKeyId) {
          await llmDeleteApiKey({ apiKeyId: misplacedKeyId }).catch(() => {
            /* ignore missing legacy entries */
          });
        }
        const savedId = await llmSaveApiKey({
          apiKeyId: DEFAULT_LLM_API_KEY_ID,
          apiKey: typedApiKey,
        });
        nextApiKeyId = savedId;
        setLegacyMisplacedKeyId(undefined);
      } else if (misplacedKeyId) {
        const migrated = await llmMigrateLegacyApiKey({ legacyApiKeyId: misplacedKeyId });
        if (migrated) {
          nextApiKeyId = DEFAULT_LLM_API_KEY_ID;
          setLegacyMisplacedKeyId(undefined);
        }
      }
      if (!nextApiKeyId) {
        throw new Error("请先填写 API Key，再点击保存配置。");
      }
      persistLlmRuntimeConfig({
        providerId,
        baseUrl,
        model,
        apiKeyId: nextApiKeyId ?? DEFAULT_LLM_API_KEY_ID,
      });
      setSavedApiKeyId(nextApiKeyId ?? DEFAULT_LLM_API_KEY_ID);
      setLlmApiKeyInMemory(null);
      bumpKeychainCheck();
      onLlmRuntimeChanged?.();
      if (typedApiKey) {
        setApiKey("");
        setMsg("已保存。API Key 已写入本地受保护存储；当前页面不再保留明文。");
      } else if (nextApiKeyId) {
        setMsg("已保存连接信息，将继续使用本地已保存的 API Key。");
      } else {
        setMsg("已保存连接信息。请填写 API Key 并保存。");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }, [apiKey, baseUrl, bumpKeychainCheck, legacyMisplacedKeyId, model, onLlmRuntimeChanged, providerId, savedApiKeyId]);
  const clearSavedApiKey = useCallback(async () => {
    if (!savedApiKeyId && !readLlmRuntimeConfigFromStorage().apiKeyId) return;
    setMsg(null);
    setProbeState("idle");
    setSaveBusy(true);
    try {
      const rawId = savedApiKeyId ?? readLlmRuntimeConfigFromStorage().apiKeyId;
      const ids = new Set<string>([DEFAULT_LLM_API_KEY_ID]);
      if (rawId?.trim()) ids.add(rawId.trim());
      for (const id of ids) {
        await llmDeleteApiKey({ apiKeyId: id }).catch(() => {
          /* ignore missing legacy entries */
        });
      }
      persistLlmRuntimeConfig({ providerId, baseUrl, model }, { clearApiKeyId: true });
      setSavedApiKeyId(null);
      setApiKey("");
      setLlmApiKeyInMemory(null);
      bumpKeychainCheck();
      onLlmRuntimeChanged?.();
      setMsg("已清除本地保存的 API Key。");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }, [baseUrl, bumpKeychainCheck, model, onLlmRuntimeChanged, providerId, savedApiKeyId]);
  const probe = useCallback(async () => {
    setMsg(null);
    setProbeBusy(true);
    try {
      const runtime = buildProbeRuntime();
      const out = await llmProbeConnection({ runtime });
      setProbeState(out.ok ? "ok" : "fail");
      if (out.ok) markLlmConnectionVerified();
      setMsg(out.ok ? `${out.message}（约 ${out.latency_ms ?? "?"} ms）` : out.message);
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
      <EnvLlmCapabilitiesSection connectionStatus={connectionStatus} />
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
            onChange={(e) => {
              invalidateProbe();
              setBaseUrl(e.target.value);
            }}
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
            onChange={(e) => {
              invalidateProbe();
              setModel(e.target.value);
            }}
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
            aria-label="API Key"
            value={apiKey}
            disabled={formBusy}
            onChange={(e) => {
              invalidateProbe();
              setApiKey(e.target.value);
            }}
            placeholder={savedApiKeyId ? "留空则沿用已保存的本地密钥" : "在厂商控制台创建并保存到本地安全存储"}
          />
          <span className={PANEL_TYPOGRAPHY.meta}>
            与在线 STT 密钥分开存放；不写入 localStorage 或项目文件。macOS 默认保存到应用数据目录受保护文件（避免钥匙串反复要求登录密码）；Windows 优先系统凭据管理器。
          </span>
        </label>

        <p className={PANEL_TYPOGRAPHY.meta}>
          {llmKeychainReferenceMessage(
            normalizeLlmApiKeyId(savedApiKeyId) ?? null,
            keychainChecking ? null : keychainReady,
          )}
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
        {probeState !== "fail" ? (
          <p
            className={[
              "text-[11px]",
              connectionStatusTone === "ok"
                ? "text-zen-saffron"
                : connectionStatusTone === "warn"
                  ? "text-notion-text-muted"
                  : "text-zen-cinnabar",
            ].join(" ")}
          >
            {connectionStatusMessage}
          </p>
        ) : null}
      </section>
    </div>
  );
}
