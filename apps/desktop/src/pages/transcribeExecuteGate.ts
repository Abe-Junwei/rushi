import { resolveOnlineTranscribeBlock } from "../services/stt/sttOnlineProviderContract";

import type { TranscribeSource } from "../services/stt/transcribeSource";
import type { BusyReason } from "./useProjectCrudController";

export type TranscribeExecuteGateInput = {
  busy: boolean;
  busyReason?: BusyReason | null;
  batchChild?: boolean;
  hasCurrent: boolean;
  currentFileId: string | null;
  /** Batch child may pass explicit file id when editor `currentFileId` is stale. */
  targetFileId?: string | null;
  localTranscribePreflight: () => string | null;
  source: TranscribeSource;
};

/** Returns user-facing block message, or null when execute may proceed. */
export function resolveTranscribeExecuteBlock(input: TranscribeExecuteGateInput): string | null {
  const batchActive = Boolean(
    input.batchChild && input.busy && input.busyReason === "batch_transcribe",
  );
  if (input.busy && !batchActive) {
    return "busy";
  }
  const effectiveFileId =
    input.batchChild && input.targetFileId ? input.targetFileId : input.currentFileId;
  if (!input.hasCurrent || !effectiveFileId) {
    if (input.hasCurrent && !effectiveFileId) {
      return "请先打开一个文件后再自动转录";
    }
    return "busy";
  }
  if (input.source === "online") {
    return resolveOnlineTranscribeBlock();
  }
  return input.localTranscribePreflight();
}
