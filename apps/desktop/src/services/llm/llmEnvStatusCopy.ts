import {
  getLlmProviderDefinition,
  tryBuildPostprocessRuntimeBridge,
  type LlmProviderId,
} from "../postprocess/postprocessRuntimeContract";
import type { OllamaDetectResponse } from "../../tauri/postprocessApi";
import type { LlmEnvMode, LlmOllamaTone } from "./llmEnvStatusTypes";
import type { LlmConnectionUiStatus } from "../postprocess/llmConnectionUi";

export function appendConfigDraftHint(detail: string, dirty: boolean): string {
  if (!dirty) return detail;
  return `${detail} 连接参数已修改，请点击「保存配置」或「探测连接」。`;
}

export function vendorLabel(providerId: LlmProviderId): string {
  return getLlmProviderDefinition(providerId)?.label ?? "API";
}

export function chipLabel(input: {
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

export function bannerTitle(input: {
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

export function bannerDetail(input: {
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

export function blockReasonForPresentation(input: {
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

export function llmPolishActiveMessage(mode: LlmEnvMode): string {
  return mode === "local" ? "正在使用本机 LLM 润色…" : "正在使用云端 LLM 润色…";
}
