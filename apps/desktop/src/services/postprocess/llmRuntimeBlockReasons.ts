import { ENV_NAV } from "../../config/environmentNavCopy";
import {
  getLlmApiKeyFromMemory,
  isLlmConnectionVerified,
  isLlmRuntimeReady,
  isLocalLoopbackLlmConfig,
  llmConfigHint,
} from "./llmRuntimeStorage";

/** 智能改稿（全文级）门禁；与单语段自动标点文案区分。 */
export function resolveStageBBlockReason(input: {
  currentFileId: string | null;
  hasSegmentText: boolean;
  keychainReady: boolean;
  keychainChecking: boolean;
  llmCapabilityOk?: boolean;
  llmCapabilityBlockReason?: string | null;
}): string | null {
  if (!input.currentFileId) {
    return "请先打开一个文件";
  }
  if (!input.hasSegmentText) {
    return "当前文件没有语段正文，无法智能改稿。";
  }
  if (!isLlmRuntimeReady()) {
    return llmConfigHint();
  }
  if (isLocalLoopbackLlmConfig()) {
    if (input.llmCapabilityOk === false) {
      return (
        input.llmCapabilityBlockReason ??
        `本机 LLM 未就绪，请在「${ENV_NAV.llm}」完成检测与探测。`
      );
    }
    return null;
  }
  if (input.keychainChecking) {
    return "正在检查 LLM 密钥状态…";
  }
  if (!input.keychainReady && !getLlmApiKeyFromMemory()?.trim()) {
    return `本地未找到 API 密钥，请在「${ENV_NAV.llm}」重新保存。`;
  }
  if (!isLlmConnectionVerified()) {
    return `请在「${ENV_NAV.llm}」完成探测后再使用智能改稿。`;
  }
  if (input.llmCapabilityOk === false) {
    return input.llmCapabilityBlockReason ?? `云端 LLM 未就绪，请在「${ENV_NAV.llm}」完成探测。`;
  }
  return null;
}


