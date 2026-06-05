import { resolveOnlineTranscribeBlock } from "../services/stt/sttOnlineProviderContract";

import type { TranscribeSource } from "../services/stt/transcribeSource";

export type TranscribeExecuteGateInput = {
  busy: boolean;
  hasCurrent: boolean;
  currentFileId: string | null;
  localTranscribePreflight: () => string | null;
  source: TranscribeSource;
};

/** Returns user-facing block message, or null when execute may proceed. */
export function resolveTranscribeExecuteBlock(input: TranscribeExecuteGateInput): string | null {
  if (input.busy || !input.hasCurrent || !input.currentFileId) {
    if (!input.busy && input.hasCurrent && !input.currentFileId) {
      return "请先打开一个文件后再自动转录";
    }
    return "busy";
  }
  if (input.source === "online") {
    return resolveOnlineTranscribeBlock();
  }
  return input.localTranscribePreflight();
}
