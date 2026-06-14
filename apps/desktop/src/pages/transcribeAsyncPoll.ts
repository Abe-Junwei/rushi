import { loopbackFetch } from "../services/asr/loopbackFetch";
import {
  describeTranscribeStatusError,
  isTranscribeTerminalPhase,
  TranscribeUserCancelledError,
  type TranscribeStatusPayload,
} from "./transcribePreviewState";

export const TRANSCRIBE_POLL_MS = 800;
export const TRANSCRIBE_ASYNC_MAX_WAIT_MS = 7_200_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { logRuntimeParity } from "../services/runtimeParity";

export function logFirstSegmentsVisibleMs(ms: number): void {
  logRuntimeParity("transcribe", `first_segments_visible_ms=${ms}`);
}

export async function postTranscribeCancel(base: string, jobId: string): Promise<void> {
  await loopbackFetch(`${base}/v1/transcribe/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId }),
  });
}

export type PollTranscribeJobOptions = {
  signal?: AbortSignal;
};

export async function pollTranscribeJob(
  jobId: string,
  base: string,
  onTick: (st: TranscribeStatusPayload) => void,
  shouldStop: () => boolean,
  options?: PollTranscribeJobOptions,
): Promise<void> {
  const deadline = Date.now() + TRANSCRIBE_ASYNC_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    if (shouldStop()) {
      throw new TranscribeUserCancelledError();
    }
    const res = await loopbackFetch(
      `${base}/v1/transcribe/status?job_id=${encodeURIComponent(jobId)}`,
      { signal: options?.signal },
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      const snippet = errBody.trim().slice(0, 200);
      throw new Error(
        snippet
          ? `转写状态查询失败（HTTP ${res.status}）：${snippet}`
          : `转写状态查询失败（HTTP ${res.status}）。`,
      );
    }
    const st = (await res.json().catch(() => ({}))) as TranscribeStatusPayload;
    onTick(st);
    if (st.phase === "done") {
      return;
    }
    if (st.phase === "cancelled") {
      throw new TranscribeUserCancelledError();
    }
    if (isTranscribeTerminalPhase(st.phase ?? "")) {
      throw new Error(describeTranscribeStatusError(st));
    }
    if (shouldStop()) {
      throw new TranscribeUserCancelledError();
    }
    await sleep(TRANSCRIBE_POLL_MS);
    if (shouldStop()) {
      throw new TranscribeUserCancelledError();
    }
  }
  try {
    await postTranscribeCancel(base, jobId);
  } catch {
    /* best-effort */
  }
  throw new Error("转写超时，请稍后重试或缩短音频后再试。");
}
