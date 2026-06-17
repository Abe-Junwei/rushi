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
import {
  publishTranscribeSegmentClear,
  publishTranscribeSegmentRestore,
} from "./flushSegmentTextDrafts";
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

type CloseGate = Pick<
  ReturnType<typeof useProjectCloseGateController>,
  "openFileWrapped"
>;
type Editor = Pick<
  ReturnType<typeof useProjectEditorState>,
  "current" | "currentFileId" | "segmentsRef" | "setCurrent" | "setSegments"
>;
type Busy = Pick<ReturnType<typeof useProjectBusyState>, "busy" | "beginBusy" | "endBusy">;
type Mutations = Pick<ReturnType<typeof useSegmentMutationController>, "resetMutationHistory">;

type Args = {
  busy: Busy["busy"];
  beginBusy: Busy["beginBusy"];
  endBusy: Busy["endBusy"];
  current: Editor["current"];
  currentFileId: Editor["currentFileId"];
  segmentsRef: Editor["segmentsRef"];
  setCurrent: Editor["setCurrent"];
  setSegments: Editor["setSegments"];
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
    beginBusy,
    endBusy,
    current,
    currentFileId,
    segmentsRef,
    setCurrent,
    setSegments,
    setError,
    closeGate,
    mutations,
    localTranscribePreflight,
    transcribeSource,
    setTranscribeStartDialogOpen,
    clearScheduledAutoSave,
    onTranscribeSuccess,
  } = args;

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
    async (fileId: string, out: p1.RunTranscribeOutcome) => {
      if (!current) return;
      await finishTranscribeSuccess({
        fileId,
        out,
        projectId: current.id,
        segmentsRef,
        setSegments,
        setCurrent,
        resetMutationHistory: mutations.resetMutationHistory,
        openFileWrapped: closeGate.openFileWrapped,
        onTranscribeSuccess,
        transcribeStartedAtMs: transcribeStartedAtRef.current ?? Date.now(),
        setTranscribeWarnings,
        setTranscribeFailureDiag,
        setTranscribeHints,
        setError,
      });
    },
    [
      closeGate,
      current,
      mutations,
      onTranscribeSuccess,
      segmentsRef,
      setCurrent,
      setError,
      setSegments,
    ],
  );

  const executeTranscribe = useCallback(async () => {
    await awaitEnvironmentCapabilityRefresh();
    if (transcribeSource === "online") {
      await ensureSttOnlineApiKeyForSession();
    }
    const block = resolveTranscribeExecuteBlock({
      busy,
      hasCurrent: !!current,
      currentFileId,
      localTranscribePreflight,
      source: transcribeSource,
    });
    if (block) {
      if (block !== "busy") {
        setError(block);
      }
      return;
    }
    const fileId = currentFileId!;
    setTranscribeStartDialogOpen(false);
    clearScheduledAutoSave?.();
    beginBusy("transcribe");
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
    const restoreSnapshot = snapshotSegmentsForRestore(segmentsRef.current);
    publishTranscribeSegmentClear(segmentsRef, setSegments);
    try {
      const online =
        transcribeSource === "online" ? tryBuildOnlineTranscribeBridgePayload() : null;
      const base = asrBaseUrl().replace(/\/+$/, "");
      let out: p1.RunTranscribeOutcome;
      if (!online) {
        const local = await runLocalTranscribeJob({
          fileId,
          base,
          segmentsRef,
          refs: runRefs,
          callbacks: { setSegments, setTranscribeProgress },
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
      await finishTranscribeSuccessCb(fileId, out);
    } catch (e) {
      publishTranscribeSegmentRestore(segmentsRef, setSegments, restoreSnapshot);
      if (isTranscribeUserCancellation(e) || isTranscribeInvokeCancelled(e)) {
        setTranscribeHints([]);
        setTranscribeWarnings([]);
        setTranscribeFailureDiag(null);
        pushTranscribeHintsToToast([TRANSCRIBE_CANCELLED_HINT]);
      } else {
        const snap = await p1.getLastTranscribeTimeline().catch(() => null);
        setTranscribeFailureDiag(snap);
        setError(humanizeInvokeError(e));
      }
    } finally {
      pollAbortRef.current?.abort();
      pollAbortRef.current = null;
      activeJobIdRef.current = null;
      userCancelRequestedRef.current = false;
      setTranscribeCancelling(false);
      setTranscribeProgress(null);
      endBusy();
    }
  }, [
    busy,
    current,
    currentFileId,
    finishTranscribeSuccessCb,
    beginBusy,
    endBusy,
    setError,
    setSegments,
    segmentsRef,
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
