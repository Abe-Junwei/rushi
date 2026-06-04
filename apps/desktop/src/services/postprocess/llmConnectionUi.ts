import {
  DEFAULT_LLM_API_KEY_ID,
  normalizeLlmApiKeyId,
} from "./llmProviderCatalog";
import { getLlmApiKeyFromMemory, llmConfigHint } from "./llmRuntimeStorage";

/** 设置页 / 编辑器共用的连接 UI 状态（不含探测结果以外的「假就绪」）。 */
export type LlmConnectionUiStatus = "missing" | "keychain_missing" | "unverified" | "verified";

export type LlmConnectionUiStatusInput = {
  /** localStorage 有 apiKeyId 或会话内存 Key */
  hasLocalKeyRef: boolean;
  /** 表单中尚未保存的 Key */
  hasTypedKey: boolean;
  /** null = 钥匙串检查中 */
  keychainPresent: boolean | null;
  /** 持久化探测指纹（与顶栏 / 导出润色共用） */
  connectionVerified: boolean;
};

export function resolveLlmConnectionUiStatus(
  input: LlmConnectionUiStatusInput & { localLoopback?: boolean },
): LlmConnectionUiStatus {
  if (input.localLoopback) {
    if (!input.hasLocalKeyRef) return "missing";
    if (input.connectionVerified) return "verified";
    return "unverified";
  }
  if (input.hasTypedKey || input.hasLocalKeyRef) {
    if (input.keychainPresent === false && !input.hasTypedKey && !getLlmApiKeyFromMemory()?.trim()) {
      return "keychain_missing";
    }
    if (input.connectionVerified) return "verified";
    return "unverified";
  }
  return "missing";
}

export function llmConnectionStatusMessage(
  status: LlmConnectionUiStatus,
  options?: { localLoopback?: boolean; ollamaTagsReady?: boolean },
): string {
  const loopback = options?.localLoopback ?? false;
  switch (status) {
    case "missing":
      return loopback
        ? "请选择 Ollama 预设并保存；确认本机已启动 Ollama（ollama serve 或 Ollama.app）。"
        : llmConfigHint();
    case "keychain_missing":
      return "配置里记录了密钥引用，但本地未找到已保存的密钥。请重新填写 API Key 并保存。";
    case "unverified":
      return loopback
        ? options?.ollamaTagsReady
          ? "Ollama 服务已就绪；请点击「探测连接」验证 chat 接口后再用自动标点。"
          : "本机 Ollama 配置已保存，尚未探测成功。请点击「探测连接」；数据不出本机。"
        : "密钥已就位，尚未验证连通性。请点击「探测连接」确认后再使用自动标点。";
    case "verified":
      return loopback
        ? "本机 Ollama 已验证：自动标点可走 loopback，数据不出本机。本地模型可能改字，请用 diff 预览确认。"
        : "连接已验证：编辑器中的自动标点等能力可用。";
  }
}

export function llmConnectionStatusTone(
  status: LlmConnectionUiStatus,
  options?: { localLoopback?: boolean; ollamaTagsReady?: boolean },
): "error" | "warn" | "ok" {
  switch (status) {
    case "missing":
    case "keychain_missing":
      return "error";
    case "unverified":
      if (options?.localLoopback && options.ollamaTagsReady) return "ok";
      return "warn";
    case "verified":
      return "ok";
  }
}

export function llmAutoPunctuateCapabilityBadge(
  status: LlmConnectionUiStatus,
  options?: { localLoopback?: boolean; ollamaTagsReady?: boolean },
): string {
  if (options?.localLoopback && status === "unverified" && options.ollamaTagsReady) {
    return "服务就绪";
  }
  switch (status) {
    case "missing":
      return "待配置";
    case "keychain_missing":
      return "密钥异常";
    case "unverified":
      return "待验证";
    case "verified":
      return "可用";
  }
}

export function llmAutoPunctuateCapabilityBadgeClass(
  status: LlmConnectionUiStatus,
  options?: { localLoopback?: boolean; ollamaTagsReady?: boolean },
): string {
  const base = "rounded px-1.5 py-0.5 text-[10px] font-semibold";
  if (options?.localLoopback && status === "unverified" && options.ollamaTagsReady) {
    return `${base} bg-zen-success/15 text-zen-success`;
  }
  if (status === "verified") {
    return `${base} bg-zen-success/15 text-zen-success`;
  }
  if (status === "unverified") {
    return `${base} bg-zen-saffron/10 text-notion-text-muted`;
  }
  return `${base} bg-notion-sidebar text-notion-text-muted`;
}

export function llmKeychainReferenceMessage(apiKeyId: string | null, keychainPresent: boolean | null): string {
  const label = apiKeyId ? (normalizeLlmApiKeyId(apiKeyId) ?? DEFAULT_LLM_API_KEY_ID) : null;
  const store =
    typeof navigator !== "undefined" &&
    /Mac/i.test(navigator.platform || navigator.userAgent || "")
      ? "应用数据目录下的受保护文件（macOS 默认不走钥匙串，避免反复弹登录密码）"
      : "系统密钥库（Windows 凭据管理器；不可用时回退为应用数据目录下的受保护文件）";
  if (!label) return `${store}：当前未保存 API Key。`;
  if (keychainPresent === null) return `${store}：正在检查已保存引用（标识：${label}）…`;
  if (keychainPresent) {
    return `${store}：已找到 API Key（标识：${label}）。输入框留空时将使用它。`;
  }
  return `${store}：未读到标识为「${label}」的密钥。请重新填写 API Key 并点击保存配置。`;
}
