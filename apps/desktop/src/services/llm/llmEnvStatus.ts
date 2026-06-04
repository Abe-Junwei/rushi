import type { OllamaDetectResponse } from "../../tauri/postprocessApi";
import {
  applyLlmProviderPreset,
  getLlmProviderDefinition,
  isLocalLoopbackLlmConfig,
  isLlmConnectionVerified,
  isLlmRuntimeReady,
  persistLlmRuntimeConfig,
  readLlmRuntimeConfigFromStorage,
  tryBuildPostprocessRuntimeBridge,
  type LlmProviderId,
} from "../postprocess/postprocessRuntimeContract";
import {
  llmAutoPunctuateCapabilityBadge,
  llmAutoPunctuateCapabilityBadgeClass,
  resolveLlmConnectionUiStatus,
  type LlmConnectionUiStatus,
} from "../postprocess/llmConnectionUi";

export type LlmEnvMode = "local" | "cloud";

export type LlmOllamaTone = "ok" | "warn" | "error" | "idle";

/** 设置页表单上下文（可选）；未传时按持久化配置推导。 */
export type LlmEnvSettingsOverlay = {
  hasLocalKeyRef: boolean;
  hasTypedKey: boolean;
  keychainPresent: boolean | null;
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
  ok: "bg-zen-success/10 text-notion-text",
  warn: "bg-zen-saffron/10 text-notion-text",
  error: "bg-zen-cinnabar/10 text-zen-cinnabar",
  idle: "bg-notion-sidebar-hover text-notion-text-muted",
};

export function readLlmEnvMode(): LlmEnvMode {
  return isLocalLoopbackLlmConfig() ? "local" : "cloud";
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
    if (input.connectionStatus === "verified") {
      return "本机 Ollama 已验证：自动标点与导出润色可用，数据不出本机。";
    }
    if (input.connectionStatus === "missing") {
      return "请选择 Ollama 预设并保存；确认本机已启动 Ollama（ollama serve 或 Ollama.app）。";
    }
    if (input.ollamaTagsReady) {
      return (
        input.ollamaDetect?.message?.trim() ||
        "Ollama 服务已就绪；请点击「探测连接」验证 chat 接口。"
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
      return "密钥已就位，尚未验证连通性。请点击「探测连接」确认后再使用自动标点与导出润色。";
    case "verified":
      return "连接已验证：编辑器自动标点、导出大模型润色等能力可用。";
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
}): string | null {
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

export function buildLlmEnvPresentation(input: {
  ollamaDetect: OllamaDetectResponse | null;
  ollamaDetectBusy: boolean;
  settings?: LlmEnvSettingsOverlay;
}): LlmEnvPresentation {
  const cfg = readLlmRuntimeConfigFromStorage();
  const mode = readLlmEnvMode();
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
  const capOpts = { localLoopback, ollamaTagsReady };

  return {
    mode,
    providerId: cfg.providerId,
    model: cfg.model,
    tone,
    chipLabel: chipLabel({ mode, ollamaTone, providerId: cfg.providerId, connectionVerified, runtimeReady }),
    ok,
    bannerTitle: bannerTitle({ mode, providerId: cfg.providerId, ollamaTone, connectionVerified, runtimeReady }),
    bannerDetail: bannerDetail({
      mode,
      connectionStatus,
      ollamaDetect: input.ollamaDetect,
      ollamaDetectBusy: input.ollamaDetectBusy,
      ollamaTagsReady,
    }),
    sourceLabel: llmPolishSourceDetailLabel({ mode, providerId: cfg.providerId, model: cfg.model }),
    capabilityBadge: llmAutoPunctuateCapabilityBadge(connectionStatus, capOpts),
    capabilityBadgeClass: llmAutoPunctuateCapabilityBadgeClass(connectionStatus, capOpts),
    connectionStatus,
    ollamaTagsReady,
    blockReason: blockReasonForPresentation({
      mode,
      ollamaTone,
      ollamaDetect: input.ollamaDetect,
      ollamaDetectBusy: input.ollamaDetectBusy,
      connectionVerified,
      runtimeReady,
      connectionStatus,
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
