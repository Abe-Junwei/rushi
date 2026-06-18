import { localSecretStoreReferenceMessage } from "../../config/environmentNavCopy";
import {
  DEFAULT_LLM_API_KEY_ID,
  normalizeLlmApiKeyId,
} from "./llmProviderCatalog";
import { getLlmApiKeyFromMemory } from "./llmRuntimeStorage";

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

export function llmExportPolishCapabilityBadge(
  status: LlmConnectionUiStatus,
  options?: { localLoopback?: boolean; ollamaTagsReady?: boolean; ollamaReachable?: boolean },
): string {
  if (options?.localLoopback && options.ollamaReachable === false) {
    return "不可用";
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

export function llmExportPolishCapabilityBadgeClass(
  status: LlmConnectionUiStatus,
  options?: { localLoopback?: boolean; ollamaTagsReady?: boolean; ollamaReachable?: boolean },
): string {
  const base = "rounded px-2 py-0.5 text-label font-semibold uppercase tracking-wider";
  if (options?.localLoopback && options.ollamaReachable === false) {
    return `${base} bg-zen-cinnabar/10 text-zen-cinnabar`;
  }
  if (status === "verified") {
    return `${base} bg-zen-success-surface text-zen-success`;
  }
  if (status === "unverified") {
    return `${base} border border-zen-saffron/20 bg-zen-saffron/10 text-zen-saffron`;
  }
  return `${base} bg-notion-sidebar text-notion-text-muted`;
}

/** 设置页「导出能力」列表项（与 llmExportPolishCapabilityBadge 对应）。 */
export const LLM_CAPABILITIES = [
  { id: "export_polish", label: "导出润色（Docx delivery）" },
] as const;

export type LlmCapabilityId = (typeof LLM_CAPABILITIES)[number]["id"];

export function llmKeychainReferenceMessage(apiKeyId: string | null, keychainPresent: boolean | null): string {
  return localSecretStoreReferenceMessage(
    apiKeyId ? (normalizeLlmApiKeyId(apiKeyId) ?? DEFAULT_LLM_API_KEY_ID) : null,
    keychainPresent,
  );
}
