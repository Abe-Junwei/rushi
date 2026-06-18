import { asrBaseUrl } from "../config/env";
import * as p1 from "../tauri/projectApi";
import { postTranscribeCancel } from "./transcribeAsyncPoll";
import {
  isOnlineTranscribeJobId,
  isSidecarCancellableTranscribeJobId,
} from "./transcribePreviewState";

export async function cancelActiveTranscribeJob(input: {
  jobId: string | null;
  transcribeCancelling: boolean;
  setTranscribeCancelling: (value: boolean) => void;
  userCancelRequestedRef: React.MutableRefObject<boolean>;
  pollAbortRef: React.MutableRefObject<AbortController | null>;
}): Promise<void> {
  const { jobId, transcribeCancelling, setTranscribeCancelling, userCancelRequestedRef, pollAbortRef } =
    input;
  if (!jobId || transcribeCancelling) return;
  setTranscribeCancelling(true);
  userCancelRequestedRef.current = true;
  pollAbortRef.current?.abort();
  if (isOnlineTranscribeJobId(jobId)) {
    try {
      await p1.projectCancelTranscribe(jobId);
    } catch {
      /* invoke may still reject with 转写已取消 */
    }
    return;
  }
  if (!isSidecarCancellableTranscribeJobId(jobId)) return;
  const base = asrBaseUrl().replace(/\/+$/, "");
  try {
    await postTranscribeCancel(base, jobId);
  } catch {
    /* poll loop will surface sidecar errors or timeout */
  }
}
