import { ENV_NAV } from "../../config/environmentNavCopy";
import { buildLlmEnvPresentation } from "../llm/llmEnvStatus";
import { getLlmEnvRuntimeSnapshot } from "../llm/llmEnvRuntimeStore";
import { llmHasStoredApiKey } from "../../tauri/postprocessApi";
import {
  getLlmApiKeyFromMemory,
  isLocalLoopbackLlmConfig,
  llmConfigHint,
  readLlmRuntimeConfigFromStorage,
  resolveStageBBlockReason,
  tryBuildPostprocessRuntimeBridge,
} from "./llmRuntimeStorage";

export type StageBLlmGateSnapshot = {
  llmCapabilityOk: boolean;
  llmCapabilityBlockReason: string | null;
  keychainReady: boolean;
  keychainChecking: boolean;
};

/** 同步读取 Stage B 所需的 LLM 能力 / keychain 门禁（无 React hook）。 */
export function readStageBLlmGateSnapshot(): StageBLlmGateSnapshot {
  const local = isLocalLoopbackLlmConfig();
  const runtime = getLlmEnvRuntimeSnapshot();
  const presentation = buildLlmEnvPresentation({
    ollamaDetect: local ? runtime.ollamaDetect : null,
    ollamaDetectBusy: local ? runtime.ollamaDetectBusy : false,
  });

  if (local) {
    return {
      llmCapabilityOk: presentation.ok,
      llmCapabilityBlockReason: presentation.blockReason,
      keychainReady: true,
      keychainChecking: false,
    };
  }

  const cfg = readLlmRuntimeConfigFromStorage();
  const hasMemoryKey = Boolean(getLlmApiKeyFromMemory()?.trim());
  const hasStoredKeyId = Boolean(cfg.apiKeyId?.trim());

  return {
    llmCapabilityOk: presentation.ok,
    llmCapabilityBlockReason: presentation.blockReason,
    keychainReady: hasMemoryKey || hasStoredKeyId,
    keychainChecking: false,
  };
}

/** 点击/启动前同步门禁（读取最新 localStorage + LLM env store）。 */
export function resolveStageBSyncBlockReason(input: {
  currentFileId: string | null;
  hasSegmentText: boolean;
}): string | null {
  const llmGate = readStageBLlmGateSnapshot();
  return resolveStageBBlockReason({
    currentFileId: input.currentFileId,
    hasSegmentText: input.hasSegmentText,
    keychainReady: llmGate.keychainReady,
    keychainChecking: llmGate.keychainChecking,
    llmCapabilityOk: llmGate.llmCapabilityOk,
    llmCapabilityBlockReason: llmGate.llmCapabilityBlockReason,
  });
}

/** 云端：确认 keychain 中 API Key 可读（避免 UI 显示可用但首次请求失败）。 */
export async function ensureStageBLlmActionReady(input: {
  currentFileId: string | null;
  hasSegmentText: boolean;
}): Promise<string | null> {
  const syncReason = resolveStageBSyncBlockReason(input);
  if (syncReason) return syncReason;
  if (isLocalLoopbackLlmConfig()) {
    return tryBuildPostprocessRuntimeBridge() ? null : llmConfigHint();
  }

  if (getLlmApiKeyFromMemory()?.trim()) return null;

  const cfg = readLlmRuntimeConfigFromStorage();
  const apiKeyId = cfg.apiKeyId?.trim();
  if (!apiKeyId) {
    return `请在「${ENV_NAV.llm}」选择厂商并保存 Key。`;
  }

  try {
    const ok = await llmHasStoredApiKey({ apiKeyId });
    if (!ok) {
      return `本地未找到 Key，请在「${ENV_NAV.llm}」重新保存。`;
    }
  } catch {
    return `无法读取 Key，请在「${ENV_NAV.llm}」重新保存。`;
  }

  if (!tryBuildPostprocessRuntimeBridge()) {
    return llmConfigHint();
  }
  return null;
}
