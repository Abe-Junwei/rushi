import type { OllamaDetectResponse } from "../../tauri/postprocessApi";
import {
  applyLlmProviderPreset,
  getLlmProviderDefinition,
  isLocalLoopbackLlmConfig,
  isLlmConnectionVerified,
  isLlmRuntimeReady,
  persistLlmRuntimeConfig,
  readLastCloudRuntimeConfig,
  readLlmRuntimeConfigFromStorage,
  tryBuildPostprocessRuntimeBridge,
  type LlmProviderId,
  type LlmRuntimeConfig,
} from "../postprocess/postprocessRuntimeContract";
import {
  llmExportPolishCapabilityBadge,
  llmExportPolishCapabilityBadgeClass,
  resolveLlmConnectionUiStatus,
  type LlmConnectionUiStatus,
} from "../postprocess/llmConnectionUi";

export type LlmEnvMode = "local" | "cloud";

export type LlmOllamaTone = "ok" | "warn" | "error" | "idle";

/** 设置页表单上下文（可选）；未传时按持久化配置推导。 */
export type LlmEnvConfigDraft = {
  providerId: LlmProviderId;
  baseUrl: string;
  model: string;
};

export type LlmEnvSettingsOverlay = {
  hasLocalKeyRef: boolean;
  hasTypedKey: boolean;
  keychainPresent: boolean | null;
  /** 设置页表单草稿；与 storage 不一致时 banner 按草稿展示并提示保存/探测。 */
  configDraft?: LlmEnvConfigDraft;
};

/** LLM 环境状态唯一 presentation 真源：顶栏芯片 / 设置条 / 能力徽章 / 导出润色共用。 */
export type LlmEnvPresentation = {
  mode: LlmEnvMode;
  providerId: LlmProviderId;
  model: string;
  tone: LlmOllamaTone;
  /** 顶栏短芯片 */
  chipLabel: string;
  /** 顶栏绿点 */
  ok: boolean;
  /** 设置页状态条标题 */
  bannerTitle: string;
  /** 设置页状态条详情 */
  bannerDetail: string;
  /** 导出润色来源芯片 */
  sourceLabel: string;
  capabilityBadge: string;
  capabilityBadgeClass: string;
  connectionStatus: LlmConnectionUiStatus;
  ollamaTagsReady: boolean;
  /** 表单草稿与 localStorage 不一致（仅设置页 overlay 传入时） */
  configDraftDirty: boolean;
  blockReason: string | null;
  polishActiveMessage: string;
};

/** 顶栏芯片：就绪=绿，未就绪=红（与 ASR 就绪一致） */
export const LLM_STATUS_DOT_CLASS: Record<LlmOllamaTone, string> = {
  ok: "bg-zen-success",
  warn: "bg-zen-saffron",
  error: "bg-zen-cinnabar",
  idle: "bg-notion-divider",
};

export const LLM_STATUS_PANEL_CLASS: Record<LlmOllamaTone, string> = {
  ok: "bg-zen-success-surface text-notion-text",
  warn: "bg-zen-saffron/10 text-notion-text",
  error: "bg-zen-cinnabar/10 text-notion-text",
  idle: "bg-notion-sidebar-hover text-notion-text-muted",
};

/** 连体卡片 banner 标题色（Stitch F1） */
export const LLM_STATUS_BANNER_TITLE_CLASS: Record<LlmOllamaTone, string> = {
  ok: "text-zen-success",
  warn: "text-zen-saffron",
  error: "text-zen-cinnabar",
  idle: "text-notion-text-muted",
};

/** 状态 banner 刷新/探测按钮基类（无 Preflight 时须压平 UA 灰底） */
export const LLM_STATUS_REFRESH_BTN_BASE =
  "inline-flex shrink-0 items-center gap-1 rounded border-0 bg-transparent px-2 py-1 text-[12px] font-medium shadow-none ring-0 appearance-none transition-colors disabled:opacity-40";

/** 状态 banner 右侧刷新/探测按钮（ok 用 action 绿，与标题/圆点 primary 绿区分） */
export const LLM_STATUS_REFRESH_BTN_CLASS: Record<LlmOllamaTone, string> = {
  ok: "text-zen-success-action hover:bg-zen-success-border/80",
  warn: "text-zen-saffron hover:bg-zen-saffron/10",
  error: "text-notion-text-muted hover:bg-notion-sidebar-hover",
  idle: "text-notion-text-muted hover:bg-notion-sidebar-hover",
};

export function readLlmEnvMode(): LlmEnvMode {
  return isLocalLoopbackLlmConfig() ? "local" : "cloud";
}

export function resolveLlmEnvEffectiveConfig(draft?: LlmEnvConfigDraft | null): LlmRuntimeConfig {
  const stored = readLlmRuntimeConfigFromStorage();
  if (!draft) return stored;
  const def = getLlmProviderDefinition(draft.providerId);
  return {
    providerId: draft.providerId,
    baseUrl: (draft.baseUrl.trim() || def?.defaultBaseUrl || stored.baseUrl).trim(),
    model: (draft.model.trim() || def?.defaultModel || stored.model).trim(),
    apiKeyId: stored.apiKeyId,
  };
}

export function llmEnvConfigDraftDirty(draft?: LlmEnvConfigDraft | null): boolean {
  if (!draft) return false;
  const stored = readLlmRuntimeConfigFromStorage();
  const effective = resolveLlmEnvEffectiveConfig(draft);
  return (
    effective.providerId !== stored.providerId ||
    effective.baseUrl !== stored.baseUrl.trim() ||
    effective.model !== stored.model.trim()
  );
}

function readLlmEnvModeForConfig(cfg: LlmRuntimeConfig): LlmEnvMode {
  return isLocalLoopbackLlmConfig(cfg) ? "local" : "cloud";
}

function appendConfigDraftHint(detail: string, dirty: boolean): string {
  if (!dirty) return detail;
  return `${detail} 连接参数已修改，请点击「保存配置」或「探测连接」。`;
}

export function ollamaDetectReady(detect: OllamaDetectResponse): boolean {
  if (!detect.reachable) return false;
  if (detect.hasConfiguredModel !== undefined) return detect.hasConfiguredModel;
  return detect.hasQwen25_7b;
}

export function toneFromOllamaDetect(
  detect: OllamaDetectResponse | null,
  busy: boolean,
): LlmOllamaTone {
  if (busy || !detect) return "idle";
  if (!detect.reachable) return "error";
  if (!ollamaDetectReady(detect)) return "warn";
  return "ok";
}

export function toneFromConnectionPhase(input: {
  mode: LlmEnvMode;
  ollamaTone: LlmOllamaTone;
  runtimeReady: boolean;
  connectionVerified: boolean;
  connectionStatus: LlmConnectionUiStatus;
}): LlmOllamaTone {
  if (input.connectionStatus === "missing" || input.connectionStatus === "keychain_missing") {
    return "error";
  }
  if (input.mode === "local") {
    if (input.ollamaTone === "idle") return "idle";
    if (input.ollamaTone === "error") return "error";
    if (input.ollamaTone === "warn") return "warn";
    return input.connectionVerified ? "ok" : "warn";
  }
  if (!input.runtimeReady) return "error";
  return input.connectionVerified ? "ok" : "warn";
}

export function llmEnvReady(input: {
  mode: LlmEnvMode;
  ollamaTone: LlmOllamaTone;
  connectionVerified: boolean;
  runtimeReady: boolean;
}): boolean {
  if (input.mode === "local") {
    return input.ollamaTone === "ok" && input.connectionVerified;
  }
  return input.runtimeReady && input.connectionVerified;
}

function vendorLabel(providerId: LlmProviderId): string {
  return getLlmProviderDefinition(providerId)?.label ?? "API";
}

function chipLabel(input: {
  mode: LlmEnvMode;
  ollamaTone: LlmOllamaTone;
  providerId: LlmProviderId;
  connectionVerified: boolean;
  runtimeReady: boolean;
}): string {
  if (input.mode === "local") {
    switch (input.ollamaTone) {
      case "ok":
        return input.connectionVerified ? "本机 LLM" : "本机 LLM 待验证";
      case "warn":
        return "本机 LLM 未就绪";
      case "error":
        return "本机 LLM 未连接";
      default:
        return "本机 LLM 检测中";
    }
  }
  const vendor = vendorLabel(input.providerId);
  if (!input.runtimeReady) return "云端 LLM 未配置";
  if (!input.connectionVerified) return `云端 ${vendor} 待验证`;
  return `云端 ${vendor}`;
}

function bannerTitle(input: {
  mode: LlmEnvMode;
  providerId: LlmProviderId;
  ollamaTone: LlmOllamaTone;
  connectionVerified: boolean;
  runtimeReady: boolean;
}): string {
  if (input.mode === "local") {
    if (input.ollamaTone === "ok" && input.connectionVerified) {
      return "本机 LLM（Ollama）· 连接就绪";
    }
    if (input.ollamaTone === "ok") {
      return "本机 LLM（Ollama）· 服务就绪";
    }
    return "本机 LLM（Ollama）";
  }
  const vendor = vendorLabel(input.providerId);
  if (input.connectionVerified && input.runtimeReady) {
    return `云端 LLM（${vendor}）· 连接就绪`;
  }
  return `云端 LLM（${vendor}）`;
}

function bannerDetail(input: {
  mode: LlmEnvMode;
  connectionStatus: LlmConnectionUiStatus;
  ollamaDetect: OllamaDetectResponse | null;
  ollamaDetectBusy: boolean;
  ollamaTagsReady: boolean;
}): string {
  if (input.mode === "local") {
    if (input.ollamaDetectBusy) return "正在检测 127.0.0.1:11434…";
    if (input.ollamaDetect && !input.ollamaDetect.reachable) {
      return (
        input.ollamaDetect.message?.trim() ||
        "无法连接 127.0.0.1:11434；请启动 Ollama.app 或 ollama serve。"
      );
    }
    if (input.connectionStatus === "verified") {
      return "本机 Ollama 已验证：导出润色可用，数据不出本机。";
    }
    if (input.connectionStatus === "missing") {
      return "请选择 Ollama 预设并保存；确认本机已启动 Ollama（ollama serve 或 Ollama.app）。";
    }
    if (input.ollamaTagsReady) {
      return (
        input.ollamaDetect?.message?.trim() ||
        "Ollama 已响应；请点击「探测连接」验证 chat 接口。"
      );
    }
    return (
      input.ollamaDetect?.message?.trim() ||
      "本机 Ollama 配置已保存，尚未探测成功。请点击「探测连接」；数据不出本机。"
    );
  }
  switch (input.connectionStatus) {
    case "missing":
      return "请打开「设置 → LLM 配置」，选择云端厂商并保存 API Key。";
    case "keychain_missing":
      return "配置里记录了密钥引用，但本地未找到已保存的密钥。请重新填写 API Key 并保存。";
    case "unverified":
      return "尚未验证连通性；Key 已保存，请点击「探测连接」。";
    case "verified":
      return "API Key 已验证；导出润色可用。";
  }
}

function blockReasonForPresentation(input: {
  mode: LlmEnvMode;
  ollamaTone: LlmOllamaTone;
  ollamaDetect: OllamaDetectResponse | null;
  ollamaDetectBusy: boolean;
  connectionVerified: boolean;
  runtimeReady: boolean;
  connectionStatus: LlmConnectionUiStatus;
  configDraftDirty?: boolean;
}): string | null {
  if (input.configDraftDirty && !input.connectionVerified) {
    return "连接参数已修改，请在设置 → LLM 配置 中保存或探测连接。";
  }
  if (input.connectionStatus === "keychain_missing") {
    return "本地未找到已保存的 API Key，请重新填写并保存。";
  }
  if (!tryBuildPostprocessRuntimeBridge()) {
    return input.mode === "local"
      ? "请打开「设置 → LLM 配置」，选择本机 Ollama 并保存模型。"
      : "请打开「设置 → LLM 配置」，选择云端厂商并保存 API Key。";
  }
  if (input.mode === "local") {
    if (input.ollamaDetectBusy) return "正在检测本机 Ollama…";
    if (input.ollamaTone === "error") {
      return (
        input.ollamaDetect?.message?.trim() ||
        "本机 Ollama 未连接，请启动 Ollama 并在设置中探测连接。"
      );
    }
    if (input.ollamaTone === "warn") {
      return (
        input.ollamaDetect?.message?.trim() ||
        "本机模型未就绪：请确认 ollama list 中存在当前模型 ID。"
      );
    }
    if (!input.connectionVerified) {
      return "本机 Ollama 尚未探测成功，请在设置 → LLM 配置 中点击「探测连接」。";
    }
    return null;
  }
  if (!input.runtimeReady) {
    return "云端 LLM 未配置 API Key，请在设置 → LLM 配置 中保存。";
  }
  if (!input.connectionVerified) {
    return "云端 LLM 尚未探测成功，请在设置 → LLM 配置 中点击「探测连接」。";
  }
  return null;
}

export function llmPolishSourceDetailLabel(input: {
  mode: LlmEnvMode;
  providerId: LlmProviderId;
  model: string;
}): string {
  const model = input.model.trim() || "未指定模型";
  if (input.mode === "local") {
    return `本机 Ollama · ${model}`;
  }
  return `云端 ${vendorLabel(input.providerId)} · ${model}`;
}

export type LlmModeToggleTones = {
  local: LlmOllamaTone;
  cloud: LlmOllamaTone;
};

function readLocalOllamaToggleConfig(): LlmRuntimeConfig {
  return applyLlmProviderPreset("ollama");
}

function llmToneForModeConfig(input: {
  mode: LlmEnvMode;
  cfg: LlmRuntimeConfig;
  ollamaDetect: OllamaDetectResponse | null;
  ollamaDetectBusy: boolean;
  keychainPresent: boolean | null;
  hasTypedKey: boolean;
}): LlmOllamaTone {
  const localLoopback = input.mode === "local";
  const ollamaTone = localLoopback
    ? toneFromOllamaDetect(input.ollamaDetect, input.ollamaDetectBusy)
    : "ok";
  const runtimeReady = localLoopback
    ? Boolean(input.cfg.baseUrl.trim() && input.cfg.model.trim())
    : Boolean(input.cfg.apiKeyId?.trim());
  const connectionVerified = isLlmConnectionVerified(input.cfg);
  const connectionStatus = resolveLlmConnectionUiStatus({
    hasLocalKeyRef: runtimeReady,
    hasTypedKey: input.hasTypedKey,
    keychainPresent: input.keychainPresent,
    connectionVerified,
    localLoopback,
  });
  return toneFromConnectionPhase({
    mode: input.mode,
    ollamaTone,
    runtimeReady,
    connectionVerified,
    connectionStatus,
  });
}

/** LLM 模式切换按钮：本机 / 云端各自独立 tone（未激活侧也反映真实状态）。 */
export function buildLlmModeToggleTones(input: {
  ollamaDetect: OllamaDetectResponse | null;
  ollamaDetectBusy: boolean;
  settings?: LlmEnvSettingsOverlay;
}): LlmModeToggleTones {
  const activeCfg = resolveLlmEnvEffectiveConfig(input.settings?.configDraft);
  const activeMode = readLlmEnvModeForConfig(activeCfg);
  const keychainPresent = input.settings?.keychainPresent ?? null;
  const hasTypedKey = input.settings?.hasTypedKey ?? false;

  const localCfg = activeMode === "local" ? activeCfg : readLocalOllamaToggleConfig();
  const cloudCfg = activeMode === "cloud" ? activeCfg : readLastCloudRuntimeConfig();

  return {
    local: llmToneForModeConfig({
      mode: "local",
      cfg: localCfg,
      ollamaDetect: input.ollamaDetect,
      ollamaDetectBusy: input.ollamaDetectBusy,
      keychainPresent,
      hasTypedKey: activeMode === "local" && hasTypedKey,
    }),
    cloud: llmToneForModeConfig({
      mode: "cloud",
      cfg: cloudCfg,
      ollamaDetect: input.ollamaDetect,
      ollamaDetectBusy: false,
      keychainPresent,
      hasTypedKey: activeMode === "cloud" && hasTypedKey,
    }),
  };
}

export function buildLlmEnvPresentation(input: {
  ollamaDetect: OllamaDetectResponse | null;
  ollamaDetectBusy: boolean;
  settings?: LlmEnvSettingsOverlay;
}): LlmEnvPresentation {
  const configDraftDirty = llmEnvConfigDraftDirty(input.settings?.configDraft);
  const cfg = resolveLlmEnvEffectiveConfig(input.settings?.configDraft);
  const mode = readLlmEnvModeForConfig(cfg);
  const localLoopback = mode === "local";
  const runtimeReady = input.settings?.hasLocalKeyRef ?? isLlmRuntimeReady();
  const hasTypedKey = input.settings?.hasTypedKey ?? false;
  const keychainPresent = input.settings?.keychainPresent ?? null;
  const connectionVerified = isLlmConnectionVerified(cfg);
  const ollamaTone = toneFromOllamaDetect(input.ollamaDetect, input.ollamaDetectBusy);
  const ollamaTagsReady = input.ollamaDetect ? ollamaDetectReady(input.ollamaDetect) : false;
  const connectionStatus = resolveLlmConnectionUiStatus({
    hasLocalKeyRef: runtimeReady,
    hasTypedKey,
    keychainPresent,
    connectionVerified,
    localLoopback,
  });
  const tone = toneFromConnectionPhase({
    mode,
    ollamaTone,
    runtimeReady,
    connectionVerified,
    connectionStatus,
  });
  const ok = llmEnvReady({ mode, ollamaTone, connectionVerified, runtimeReady });
  const capOpts = {
    localLoopback,
    ollamaTagsReady,
    ollamaReachable: input.ollamaDetect?.reachable,
  };
  const bannerDetailRaw = bannerDetail({
    mode,
    connectionStatus,
    ollamaDetect: input.ollamaDetect,
    ollamaDetectBusy: input.ollamaDetectBusy,
    ollamaTagsReady,
  });

  return {
    mode,
    providerId: cfg.providerId,
    model: cfg.model,
    tone,
    chipLabel: chipLabel({ mode, ollamaTone, providerId: cfg.providerId, connectionVerified, runtimeReady }),
    ok,
    bannerTitle: bannerTitle({ mode, providerId: cfg.providerId, ollamaTone, connectionVerified, runtimeReady }),
    bannerDetail: appendConfigDraftHint(bannerDetailRaw, configDraftDirty),
    sourceLabel: llmPolishSourceDetailLabel({ mode, providerId: cfg.providerId, model: cfg.model }),
    capabilityBadge: llmExportPolishCapabilityBadge(connectionStatus, capOpts),
    capabilityBadgeClass: llmExportPolishCapabilityBadgeClass(connectionStatus, capOpts),
    connectionStatus,
    ollamaTagsReady,
    configDraftDirty,
    blockReason: blockReasonForPresentation({
      mode,
      ollamaTone,
      ollamaDetect: input.ollamaDetect,
      ollamaDetectBusy: input.ollamaDetectBusy,
      connectionVerified,
      runtimeReady,
      connectionStatus,
      configDraftDirty,
    }),
    polishActiveMessage: mode === "local" ? "正在使用本机 LLM 润色…" : "正在使用云端 LLM 润色…",
  };
}

/** @deprecated 使用 buildLlmEnvPresentation */
export type LlmPolishReadiness = {
  mode: LlmEnvMode;
  sourceLabel: string;
  shortLabel: string;
  tone: LlmOllamaTone;
  ready: boolean;
  blockReason: string | null;
};

/** @deprecated 使用 buildLlmEnvPresentation */
export function buildLlmPolishReadiness(input: {
  ollamaDetect: OllamaDetectResponse | null;
  ollamaDetectBusy: boolean;
}): LlmPolishReadiness {
  const p = buildLlmEnvPresentation(input);
  return {
    mode: p.mode,
    sourceLabel: p.sourceLabel,
    shortLabel: p.chipLabel,
    tone: p.tone,
    ready: p.ok,
    blockReason: p.blockReason,
  };
}

/** @deprecated 使用 buildLlmEnvPresentation().chipLabel */
export function llmTopStatusShortLabel(input: {
  mode: LlmEnvMode;
  ollamaTone: LlmOllamaTone;
  providerId: LlmProviderId;
  cloudConnectionVerified: boolean;
  runtimeReady: boolean;
}): string {
  return chipLabel({
    mode: input.mode,
    ollamaTone: input.ollamaTone,
    providerId: input.providerId,
    connectionVerified: input.cloudConnectionVerified,
    runtimeReady: input.runtimeReady,
  });
}

/** @deprecated 使用 buildLlmEnvPresentation().ok */
export function llmTopStatusOk(input: {
  mode: LlmEnvMode;
  ollamaTone: LlmOllamaTone;
  cloudConnectionVerified: boolean;
  runtimeReady: boolean;
}): boolean {
  return llmEnvReady({
    mode: input.mode,
    ollamaTone: input.ollamaTone,
    connectionVerified: input.cloudConnectionVerified,
    runtimeReady: input.runtimeReady,
  });
}

/** @deprecated 使用 buildLlmEnvPresentation().polishActiveMessage */
export function llmPolishActiveMessage(mode: LlmEnvMode): string {
  return mode === "local" ? "正在使用本机 LLM 润色…" : "正在使用云端 LLM 润色…";
}

/** 一键切到本机 Ollama 预设并持久化（无需 API Key）。 */
export function activateLocalOllamaPreset(): void {
  persistLlmRuntimeConfig(applyLlmProviderPreset("ollama"), { clearApiKeyId: true });
}

export function readLlmEnvSnapshot() {
  const cfg = readLlmRuntimeConfigFromStorage();
  return { mode: readLlmEnvMode(), providerId: cfg.providerId };
}
