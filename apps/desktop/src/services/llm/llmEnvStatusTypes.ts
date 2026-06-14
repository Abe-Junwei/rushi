import type { LlmProviderId } from "../postprocess/postprocessRuntimeContract";

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
  connectionStatus: import("../postprocess/llmConnectionUi").LlmConnectionUiStatus;
  ollamaTagsReady: boolean;
  /** 表单草稿与 localStorage 不一致（仅设置页 overlay 传入时） */
  configDraftDirty: boolean;
  blockReason: string | null;
  polishActiveMessage: string;
};

export type LlmModeToggleTones = {
  local: LlmOllamaTone;
  cloud: LlmOllamaTone;
};
