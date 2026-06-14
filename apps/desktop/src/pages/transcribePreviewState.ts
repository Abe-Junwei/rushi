import type { SegmentDto } from "../tauri/projectApi";

export type TranscribeProgress = {
  windowIndex: number;
  windowCount: number;
  segmentsTotal: number;
};

export type TranscribeStatusPayload = {
  phase: string;
  window_index?: number;
  window_count?: number;
  segments_total?: number;
  segments_delta?: Array<Record<string, unknown>>;
  error?: { code?: string; message?: string } | null;
  message?: string;
};

let previewUidCounter = 0;

function nextPreviewUid(): string {
  previewUidCounter += 1;
  return `preview-${previewUidCounter}`;
}

/** Deep-copy segments for restore on cancel/error (R3e-C). */
export function snapshotSegmentsForRestore(segments: readonly SegmentDto[]): SegmentDto[] {
  return segments.map((s) => ({ ...s }));
}

function parseDeltaSegment(row: Record<string, unknown>, idx: number): SegmentDto | null {
  const start = typeof row.start_sec === "number" ? row.start_sec : null;
  const end = typeof row.end_sec === "number" ? row.end_sec : null;
  if (start == null || end == null) return null;
  const text = typeof row.text === "string" ? row.text : "";
  const confidence = typeof row.confidence === "number" ? row.confidence : null;
  const lowConfidence = row.low_confidence === true;
  const detail =
    typeof row.detail === "string" && row.detail.trim().length > 0 ? row.detail : null;
  const kindRaw = typeof row.kind === "string" ? row.kind : "speech";
  const kind = kindRaw === "placeholder" ? "placeholder" : "speech";
  return {
    uid: nextPreviewUid(),
    idx,
    start_sec: start,
    end_sec: end,
    text,
    confidence,
    low_confidence: lowConfidence,
    detail,
    kind,
  };
}

/** Append sidecar ``segments_delta`` to preview list with sequential idx. */
export function mergeTranscribeSegmentsDelta(
  current: readonly SegmentDto[],
  delta: readonly Record<string, unknown>[] | undefined,
): SegmentDto[] {
  if (!delta?.length) return [...current];
  const out = [...current];
  for (const row of delta) {
    const parsed = parseDeltaSegment(row, out.length);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function parseTranscribeProgress(st: TranscribeStatusPayload): TranscribeProgress | null {
  const windowCount = typeof st.window_count === "number" ? st.window_count : 0;
  const windowIndex = typeof st.window_index === "number" ? st.window_index : 0;
  const segmentsTotal = typeof st.segments_total === "number" ? st.segments_total : 0;
  if (windowCount <= 0 && segmentsTotal <= 0) return null;
  return { windowIndex, windowCount, segmentsTotal };
}

export function isTranscribeTerminalPhase(phase: string): boolean {
  return phase === "done" || phase === "error" || phase === "cancelled" || phase === "unknown";
}

import { readShellManagesBundledSidecarSync } from "../services/shellCapabilities";

/** Sidecar lacks R3e-C async routes (stale PyInstaller build). */
export function isTranscribeAsyncUnavailable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /\b404\b/.test(msg) &&
    (/transcribe\/async|Not Found|transcribe_async/i.test(msg) || msg.includes("detail"))
  );
}

export const TRANSCRIBE_ASYNC_FALLBACK_HINT_DEV =
  "当前侧车不支持增量转写（缺少 /v1/transcribe/async），已回退为整段拉取。请用源码侧车（npm run desktop:dev 会提示）或重建内置侧车：scripts/build-asr-sidecar-unix.sh。";

export const TRANSCRIBE_ASYNC_FALLBACK_HINT_PACKAGED =
  "当前侧车不支持增量转写，已回退为整段拉取。请在「环境 → 本机 ASR」点「应用并重启侧车」或「一键准备本机 ASR」。";

function transcribeAsyncFallbackHintFromShellManaged(shellManaged: boolean): string {
  return shellManaged
    ? TRANSCRIBE_ASYNC_FALLBACK_HINT_PACKAGED
    : TRANSCRIBE_ASYNC_FALLBACK_HINT_DEV;
}

export function transcribeAsyncFallbackHint(): string {
  return transcribeAsyncFallbackHintFromShellManaged(readShellManagesBundledSidecarSync());
}

export const TRANSCRIBE_PREVIEW_BLOCK_REASON =
  "转写预览中，请等待完成或停止转写。";

export const TRANSCRIBE_CANCELLED_HINT = "已停止转写，语段已恢复。";

/** Placeholder until `projectTranscribeAsyncStart` returns a sidecar job id. */
export const TRANSCRIBE_PENDING_JOB_ID = "__transcribe_pending__";

export function isSidecarCancellableTranscribeJobId(jobId: string): boolean {
  return jobId !== TRANSCRIBE_PENDING_JOB_ID && !jobId.startsWith("online-stt-");
}

export function isOnlineTranscribeJobId(jobId: string): boolean {
  return jobId.startsWith("online-stt-");
}

export function newOnlineTranscribeJobId(): string {
  return `online-stt-${Date.now()}`;
}

export class TranscribeUserCancelledError extends Error {
  constructor() {
    super("转写已取消");
    this.name = "TranscribeUserCancelledError";
  }
}

export function isTranscribeUserCancellation(error: unknown): boolean {
  return error instanceof TranscribeUserCancelledError;
}

/** Rust `project_run_transcribe` abort via `project_cancel_transcribe`. */
export function isTranscribeInvokeCancelled(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("转写已取消");
}

export function describeTranscribeStatusError(st: TranscribeStatusPayload): string {
  const fromError = st.error?.message?.trim();
  if (fromError) return fromError;
  const msg = typeof st.message === "string" ? st.message.trim() : "";
  if (msg && msg !== "ok") return msg;
  if (st.phase === "cancelled") return "转写已取消";
  if (st.phase === "unknown") return "转写任务不存在（侧车可能已重启）";
  return "转写失败";
}

/** Test helper */
export function resetPreviewUidCounterForTests(): void {
  previewUidCounter = 0;
}
