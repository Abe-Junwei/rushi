import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { asrBaseUrl } from "../config/env";
import { finishTranscribeSuccess } from "./transcribeJobExecuteFinish";
import { humanizeInvokeError } from "../services/ui/humanizeInvokeError";
import { pushTranscribeHintsToToast } from "../services/ui/toast";
import type { TranscribeTimelineSnapshot } from "../services/transcribeDiag";
import {
  ensureSttOnlineApiKeyForSession,
  ensureSttOnlineApiSecretForSession,
  tryBuildOnlineTranscribeBridgePayload,
} from "../services/stt/sttOnlineProviderContract";
import type { ProjectDetail } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { awaitEnvironmentCapabilityRefresh } from "../services/environmentCapabilityCoordinator";
import { resolveTranscribeExecuteBlock } from "./transcribeExecuteGate";
import { runLocalTranscribeJob } from "./transcribeLocalJobRun";
import {
  isTranscribeInvokeCancelled,
  isTranscribeUserCancellation,
  newOnlineTranscribeJobId,
  snapshotSegmentsForRestore,
  TRANSCRIBE_CANCELLED_HINT,
  transcribeAsyncFallbackHint,
  type TranscribeProgress,
} from "./transcribePreviewState";
import { cancelActiveTranscribeJob } from "./transcribeJobExecuteCancel";
import type {
  ExecuteTranscribeOptions,
  ExecuteTranscribeResult,
  TranscribeJobExecuteArgs,
} from "./transcribeJobExecuteTypes";

export type { ExecuteTranscribeOptions, ExecuteTranscribeResult } from "./transcribeJobExecuteTypes";

export function useTranscribeJobExecute(args: TranscribeJobExecuteArgs) {
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
  const appliedSegmentCountRef = useRef(0);
  const pollAbortRef = useRef<AbortController | null>(null);

  const runRefs = useMemo(
    () => ({
      activeJobId: activeJobIdRef,
      userCancelRequested: userCancelRequestedRef,
      transcribeStartedAtMs: transcribeStartedAtRef,
      firstSegmentsLogged: firstSegmentsLoggedRef,
      pollAbort: pollAbortRef,
      appliedSegmentCount: appliedSegmentCountRef,
    }),
    [],
  );

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
      await ensureSttOnlineApiSecretForSession();
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
    appliedSegmentCountRef.current = 0;
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
    runRefs,
    transcribeSource,
    setTranscribeStartDialogOpen,
  ]);

  const cancelTranscribe = useCallback(async () => {
    await cancelActiveTranscribeJob({
      jobId: activeJobIdRef.current,
      transcribeCancelling,
      setTranscribeCancelling,
      userCancelRequestedRef,
      pollAbortRef,
    });
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
