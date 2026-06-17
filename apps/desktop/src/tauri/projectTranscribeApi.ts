import { invoke } from "@tauri-apps/api/core";
import type { OnlineTranscribeBridgePayload } from "../services/stt/sttOnlineProviderContract";
import type { TranscribeTimelineSnapshot } from "../services/transcribeDiag";
import type { FileDetail } from "./projectTypes";

/** `project_run_transcribe` 返回值（`detail` 为转写后的文件详情） */
export interface RunTranscribeOutcome {
  detail: FileDetail;
  engine: string;
  warnings: string[];
  transcribeTimeline?: TranscribeTimelineSnapshot | null;
}

export async function projectRunTranscribe(
  fileId: string,
  asrBaseUrl?: string | null,
  online?: OnlineTranscribeBridgePayload | null,
  requestId?: string | null,
): Promise<RunTranscribeOutcome> {
  return invoke<RunTranscribeOutcome>("project_run_transcribe", {
    fileId,
    asrBaseUrl: asrBaseUrl ?? null,
    online: online ?? null,
    requestId: requestId ?? null,
  });
}

export async function projectCancelTranscribe(requestId: string): Promise<boolean> {
  return invoke<boolean>("project_cancel_transcribe", { requestId });
}

export async function projectTranscribeAsyncStart(
  fileId: string,
  asrBaseUrl?: string | null,
): Promise<{ jobId: string }> {
  const out = await invoke<{ jobId: string }>("project_transcribe_async_start", {
    fileId,
    asrBaseUrl: asrBaseUrl ?? null,
  });
  return out;
}

export async function projectTranscribeAsyncFinalize(
  fileId: string,
  jobId: string,
  asrBaseUrl?: string | null,
): Promise<RunTranscribeOutcome> {
  return invoke<RunTranscribeOutcome>("project_transcribe_async_finalize", {
    fileId,
    jobId,
    asrBaseUrl: asrBaseUrl ?? null,
  });
}

export async function getLastTranscribeTimeline(): Promise<TranscribeTimelineSnapshot | null> {
  return invoke<TranscribeTimelineSnapshot | null>("get_last_transcribe_timeline");
}

export async function recordTranscribeTimelinePollProgress(
  jobId: string,
  windowIndex: number,
  windowCount: number,
): Promise<void> {
  return invoke<void>("record_transcribe_timeline_poll_progress", {
    jobId,
    windowIndex,
    windowCount,
  });
}

export async function recordTranscribeTimelinePollFailure(
  jobId: string,
  errorMessage: string,
): Promise<void> {
  return invoke<void>("record_transcribe_timeline_poll_failure", {
    jobId,
    errorMessage,
  });
}
