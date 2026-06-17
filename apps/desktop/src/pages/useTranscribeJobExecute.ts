import { useCallback, useEffect, useRef, useState } from "react";
import { asrBaseUrl } from "../config/env";
import { finishTranscribeSuccess } from "./transcribeJobExecuteFinish";
import { humanizeInvokeError } from "../services/ui/humanizeInvokeError";
import { pushTranscribeHintsToToast } from "../services/ui/toast";
import type { TranscribeTimelineSnapshot } from "../services/transcribeDiag";
import {
  ensureSttOnlineApiKeyForSession,
  tryBuildOnlineTranscribeBridgePayload,
} from "../services/stt/sttOnlineProviderContract";
import type { TranscribeSource } from "../services/stt/transcribeSource";
import type { ProjectDetail } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import type { useProjectCloseGateController } from "./useProjectCloseGateController";
import type { useProjectEditorState } from "./useProjectEditorState";
import type { useProjectBusyState } from "./useProjectBusyState";
import type { useSegmentMutationController } from "./useSegmentMutationController";
import { postTranscribeCancel } from "./transcribeAsyncPoll";
import { awaitEnvironmentCapabilityRefresh } from "../services/environmentCapabilityCoordinator";
import { resolveTranscribeExecuteBlock } from "./transcribeExecuteGate";
import { runLocalTranscribeJob } from "./transcribeLocalJobRun";
import type { SegmentPublishApi } from "./segmentPublishApi";
import {
  isOnlineTranscribeJobId,
  isSidecarCancellableTranscribeJobId,
  isTranscribeInvokeCancelled,
  isTranscribeUserCancellation,
  newOnlineTranscribeJobId,
  snapshotSegmentsForRestore,
  TRANSCRIBE_CANCELLED_HINT,
  transcribeAsyncFallbackHint,
  type TranscribeProgress,
} from "./transcribePreviewState";
import type { LocalTranscribePreflight } from "./transcribeJobHelpers";
import type { BusyReason } from "./useProjectCrudController";

export type ExecuteTranscribeOptions = {
  /** Parent holds `batch_transcribe` busy; skip inner begin/end busy. */
  batchChild?: boolean;
  /** Required for batch child when editor `currentFileId` may be stale. */
  fileId?: string;
  /** Batch queue: skip per-file delivery toasts. */
  suppressUserToasts?: boolean;
};

export type ExecuteTranscribeResult =
  | { ok: true }
  | { ok: false; message: string };

type CloseGate = Pick<
  ReturnType<typeof useProjectCloseGateController>,
  "openFileWrapped"
>;
type Editor = Pick<
  ReturnType<typeof useProjectEditorState>,
  "current" | "currentFileId" | "setCurrent"
>;
type Busy = Pick<ReturnType<typeof useProjectBusyState>, "busy" | "beginBusy" | "endBusy">;
type Mutations = Pick<ReturnType<typeof useSegmentMutationController>, "resetMutationHistory">;

type Args = {
  busy: Busy["busy"];
  busyReason: BusyReason | null;
  beginBusy: Busy["beginBusy"];
  endBusy: Busy["endBusy"];
  current: Editor["current"];
  currentFileId: Editor["currentFileId"];
  segmentPublish: SegmentPublishApi;
  setCurrent: Editor["setCurrent"];
  setError: (msg: string) => void;
  closeGate: CloseGate;
  mutations: Mutations;
  localTranscribePreflight: LocalTranscribePreflight;
  transcribeSource: TranscribeSource;
  setTranscribeStartDialogOpen: (open: boolean) => void;
  clearScheduledAutoSave?: () => void;
  onTranscribeSuccess?: (out: p1.RunTranscribeOutcome) => void;
};

export function useTranscribeJobExecute(args: Args) {
  const {
    busy,
    busyReason,
    beginBusy,
    endBusy,
    current,
    currentFileId,
    segmentPublish,
    setCurrent,
    setError,
    closeGate,
    mutations,
    localTranscribePreflight,
    transcribeSource,
    setTranscribeStartDialogOpen,
    clearScheduledAutoSave,
    onTranscribeSuccess,
  } = args;

  const getCurrentSegmentsSnapshot = segmentPublish.getCurrentSegmentsSnapshot;

  const [transcribeHints, setTranscribeHints] = useState<string[]>([]);
  const [transcribeWarnings, setTranscribeWarnings] = useState<string[]>([]);
  const [transcribeProgress, setTranscribeProgress] = useState<TranscribeProgress | null>(null);
  const [transcribeCancelling, setTranscribeCancelling] = useState(false);
  const [transcribeFailureDiag, setTranscribeFailureDiag] =
    useState<TranscribeTimelineSnapshot | null>(null);

  const activeJobIdRef = useRef<string | null>(null);
  const userCancelRequestedRef = useRef(false);
  const transcribeStartedAtRef = useRef(0);
  const firstSegmentsLoggedRef = useRef(false);
  const pollAbortRef = useRef<AbortController | null>(null);

  const runRefs = {
    activeJobId: activeJobIdRef,
    userCancelRequested: userCancelRequestedRef,
    transcribeStartedAtMs: transcribeStartedAtRef,
    firstSegmentsLogged: firstSegmentsLoggedRef,
    pollAbort: pollAbortRef,
  };

  useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
      pollAbortRef.current = null;
      activeJobIdRef.current = null;
    };
  }, []);

  const finishTranscribeSuccessCb = useCallback(
    async (
      fileId: string,
      out: p1.RunTranscribeOutcome,
      suppressUserToasts: boolean,
    ): Promise<boolean> => {
      if (!current) return false;
      return finishTranscribeSuccess({
        fileId,
        out,
        projectId: current.id,
        segmentPublish,
        setCurrent,
        resetMutationHistory: mutations.resetMutationHistory,
        openFileWrapped: closeGate.openFileWrapped,
        onTranscribeSuccess,
        transcribeStartedAtMs: transcribeStartedAtRef.current ?? Date.now(),
        setTranscribeWarnings,
        setTranscribeFailureDiag,
        setTranscribeHints,
        setError,
        suppressUserToasts,
      });
    },
    [
      closeGate,
      current,
      mutations,
      onTranscribeSuccess,
      segmentPublish,
      setCurrent,
      setError,
    ],
  );

  const executeTranscribe = useCallback(async (opts?: ExecuteTranscribeOptions): Promise<ExecuteTranscribeResult> => {
    if (!opts?.batchChild) {
      await awaitEnvironmentCapabilityRefresh();
    }
    if (transcribeSource === "online") {
      await ensureSttOnlineApiKeyForSession();
    }
    const targetFileId = opts?.fileId ?? currentFileId;
    const block = resolveTranscribeExecuteBlock({
      busy,
      busyReason,
      batchChild: opts?.batchChild,
      hasCurrent: !!current,
      currentFileId,
      targetFileId,
      localTranscribePreflight,
      source: transcribeSource,
    });
    if (block) {
      if (block !== "busy") {
        setError(block);
      }
      return { ok: false, message: block === "busy" ? "当前有任务进行中" : block };
    }
    const fileId = targetFileId!;
    if (!opts?.batchChild) {
      setTranscribeStartDialogOpen(false);
    }
    clearScheduledAutoSave?.();
    if (!opts?.batchChild) {
      beginBusy("transcribe");
    }
    pollAbortRef.current?.abort();
    pollAbortRef.current = new AbortController();
    setError("");
    setTranscribeHints([]);
    setTranscribeWarnings([]);
    setTranscribeFailureDiag(null);
    setTranscribeProgress(null);
    setTranscribeCancelling(false);
    userCancelRequestedRef.current = false;
    firstSegmentsLoggedRef.current = false;
    transcribeStartedAtRef.current = Date.now();
    const restoreSnapshot = snapshotSegmentsForRestore(getCurrentSegmentsSnapshot());
    segmentPublish.publishTranscribeClear();
    const suppressUserToasts = Boolean(opts?.suppressUserToasts ?? opts?.batchChild);
    try {
      const online =
        transcribeSource === "online" ? tryBuildOnlineTranscribeBridgePayload() : null;
      const base = asrBaseUrl().replace(/\/+$/, "");
      let out: p1.RunTranscribeOutcome;
      if (!online) {
        const local = await runLocalTranscribeJob({
          fileId,
          base,
          segmentPublish,
          refs: runRefs,
          callbacks: { setTranscribeProgress },
        });
        out = local.out;
        if (local.usedAsyncFallback) {
          pushTranscribeHintsToToast([transcribeAsyncFallbackHint()]);
        }
      } else {
        const requestId = newOnlineTranscribeJobId();
        activeJobIdRef.current = requestId;
        out = await p1.projectRunTranscribe(fileId, asrBaseUrl(), online ?? null, requestId);
      }
      const produced = await finishTranscribeSuccessCb(fileId, out, suppressUserToasts);
      if (!produced) {
        return { ok: false, message: "转写未产出可用语段。" };
      }
      return { ok: true };
    } catch (e) {
      segmentPublish.publishTranscribeRestore(restoreSnapshot);
      if (isTranscribeUserCancellation(e) || isTranscribeInvokeCancelled(e)) {
        setTranscribeHints([]);
        setTranscribeWarnings([]);
        setTranscribeFailureDiag(null);
        if (!suppressUserToasts) {
          pushTranscribeHintsToToast([TRANSCRIBE_CANCELLED_HINT]);
        }
        return { ok: false, message: TRANSCRIBE_CANCELLED_HINT };
      }
      const snap = await p1.getLastTranscribeTimeline().catch(() => null);
      setTranscribeFailureDiag(snap);
      const message = humanizeInvokeError(e);
      setError(message);
      return { ok: false, message };
    } finally {
      pollAbortRef.current?.abort();
      pollAbortRef.current = null;
      activeJobIdRef.current = null;
      userCancelRequestedRef.current = false;
      setTranscribeCancelling(false);
      setTranscribeProgress(null);
      if (!opts?.batchChild) {
        endBusy();
      }
    }
  }, [
    busy,
    busyReason,
    current,
    currentFileId,
    finishTranscribeSuccessCb,
    beginBusy,
    endBusy,
    setError,
    segmentPublish,
    getCurrentSegmentsSnapshot,
    localTranscribePreflight,
    clearScheduledAutoSave,
    transcribeSource,
    setTranscribeStartDialogOpen,
  ]);

  const cancelTranscribe = useCallback(async () => {
    const jobId = activeJobIdRef.current;
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
  }, [transcribeCancelling]);

  const applyDetail = useCallback((_d: ProjectDetail) => {
    setTranscribeHints([]);
    setTranscribeWarnings([]);
    setTranscribeFailureDiag(null);
    setTranscribeStartDialogOpen(false);
    setTranscribeProgress(null);
    setTranscribeCancelling(false);
  }, [setTranscribeStartDialogOpen]);

  return {
    transcribeHints,
    transcribeWarnings,
    setTranscribeHints,
    setTranscribeWarnings,
    transcribeProgress,
    transcribeCancelling,
    transcribeFailureDiag,
    setTranscribeFailureDiag,
    executeTranscribe,
    cancelTranscribe,
    applyDetailClearTranscribe: applyDetail,
  };
}
