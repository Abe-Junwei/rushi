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

export function logFirstSegmentsVisibleMs(ms: number): void {
  if (import.meta.env.DEV) {
    console.info("[r3e-c] first_segments_visible_ms=", ms);
  }
}

export async function postTranscribeCancel(base: string, jobId: string): Promise<void> {
  await loopbackFetch(`${base}/v1/transcribe/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId }),
  });
}

export async function pollTranscribeJob(
  jobId: string,
  base: string,
  onTick: (st: TranscribeStatusPayload) => void,
  shouldStop: () => boolean,
): Promise<void> {
  const deadline = Date.now() + TRANSCRIBE_ASYNC_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    if (shouldStop()) {
      throw new TranscribeUserCancelledError();
    }
    const res = await loopbackFetch(
      `${base}/v1/transcribe/status?job_id=${encodeURIComponent(jobId)}`,
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
      if (shouldStop()) throw new TranscribeUserCancelledError();
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
