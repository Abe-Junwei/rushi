import {
  isSttOnlineEnabledButIncomplete,
  tryBuildOnlineTranscribeBridgePayload,
} from "../services/stt/sttOnlineProviderContract";

export type TranscribeExecuteGateInput = {
  busy: boolean;
  hasCurrent: boolean;
  currentFileId: string | null;
  localTranscribePreflight: () => string | null;
};

/** Returns user-facing block message, or null when execute may proceed. */
export function resolveTranscribeExecuteBlock(input: TranscribeExecuteGateInput): string | null {
  if (input.busy || !input.hasCurrent || !input.currentFileId) {
    if (!input.busy && input.hasCurrent && !input.currentFileId) {
      return "请先打开一个文件后再拉取语段";
    }
    return "busy";
  }
  if (isSttOnlineEnabledButIncomplete()) {
    return "已启用在线 STT：请在「环境与 ASR」中选择厂商、填写 API Key 并点击保存在线配置；自建网关还须填写 HTTPS 转写 URL。OpenAI / AssemblyAI 可留空 URL 使用默认端点。";
  }
  if (!tryBuildOnlineTranscribeBridgePayload()) {
    return input.localTranscribePreflight();
  }
  return null;
}
