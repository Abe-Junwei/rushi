export {
  DEFAULT_LLM_API_KEY_ID,
  getLlmProviderDefinition,
  getLlmProviderKind,
  isCorruptLlmApiKeyId,
  isLocalLoopbackLlmProvider,
  LLM_CAPABILITIES,
  LLM_CONNECTION_VERIFIED_EVENT,
  LLM_PROVIDER_DEFINITIONS,
  LLM_STORAGE_KEYS,
  normalizeLlmApiKeyId,
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_DEFAULT_MODEL,
  OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY,
  OLLAMA_TAGS_URL,
  type LlmCapability,
  type LlmProviderDefinition,
  type LlmProviderId,
  type LlmProviderKind,
} from "./llmProviderCatalog";

export {
  applyLlmProviderPreset,
  clearLlmConnectionVerified,
  getLlmApiKeyFromMemory,
  isLlmConnectionVerified,
  isLlmRuntimeReady,
  isLocalLoopbackLlmConfig,
  llmConfigHint,
  llmRuntimeConnectionFingerprint,
  markLlmConnectionVerified,
  persistLlmRuntimeConfig,
  readLastCloudRuntimeConfig,
  readLlmRuntimeConfigFromStorage,
  resolveAutoPunctuateBlockReason,
  setLlmApiKeyInMemory,
  snapshotLastCloudRuntimeFromStorage,
  tryBuildPostprocessRuntimeBridge,
  validateLlmConnectionDraft,
  type LlmRuntimeConfig,
  type PersistLlmRuntimeConfigOptions,
  type PostprocessRuntimeBridge,
} from "./llmRuntimeStorage";

export {
  llmExportPolishCapabilityBadge,
  llmExportPolishCapabilityBadgeClass,
  llmKeychainReferenceMessage,
  resolveLlmConnectionUiStatus,
  type LlmConnectionUiStatus,
  type LlmConnectionUiStatusInput,
} from "./llmConnectionUi";

// --- 兼容旧命名（内部调用逐步迁移） ---
export type PostprocessProviderId = import("./llmProviderCatalog").LlmProviderId;
export type PostprocessRuntimeConfig = import("./llmRuntimeStorage").LlmRuntimeConfig;

import { LLM_PROVIDER_DEFINITIONS, LLM_STORAGE_KEYS } from "./llmProviderCatalog";
import {
  applyLlmProviderPreset,
  getLlmApiKeyFromMemory,
  isLlmRuntimeReady,
  llmConfigHint,
  persistLlmRuntimeConfig,
  readLlmRuntimeConfigFromStorage,
  setLlmApiKeyInMemory,
} from "./llmRuntimeStorage";
import { getLlmProviderDefinition } from "./llmProviderCatalog";

export const POSTPROCESS_PROVIDER_DEFINITIONS = LLM_PROVIDER_DEFINITIONS;
export const POSTPROCESS_STORAGE_KEYS = LLM_STORAGE_KEYS;
export const getPostprocessProviderDefinition = getLlmProviderDefinition;
export const readPostprocessRuntimeConfigFromStorage = readLlmRuntimeConfigFromStorage;
export const persistPostprocessRuntimeConfig = persistLlmRuntimeConfig;
export const applyPostprocessProviderPreset = applyLlmProviderPreset;
export const setPostprocessApiKeyInMemory = setLlmApiKeyInMemory;
export const getPostprocessApiKeyFromMemory = getLlmApiKeyFromMemory;
export const isPostprocessRuntimeReady = isLlmRuntimeReady;
export const postprocessConfigHint = llmConfigHint;
