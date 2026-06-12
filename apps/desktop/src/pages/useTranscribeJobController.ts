import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { asrBaseUrl } from "../config/env";
import {
  formatTranscribeVocabularyPreflightLines,
  loadTranscribeVocabularyPreflight,
} from "../services/asr/transcribeVocabularyPreflight";
import { deriveTranscribeHints } from "../services/asrTranscribeHints";
import {
  formatTranscribeDiagSummary,
  type TranscribeTimelineSnapshot,
} from "../services/transcribeDiag";
import {
  buildTranscribeResultSummary,
  countTranscribeCharacters,
} from "../services/asr/transcribeResultToast";
import { pushTranscribeHintsToToast, pushTranscribeResultToast } from "../services/ui/toast";
import { humanizeInvokeError } from "../services/ui/humanizeInvokeError";
import {
  ensureSttOnlineApiKeyForSession,
  isOnlineTranscribeReady,
  tryBuildOnlineTranscribeBridgePayload,
} from "../services/stt/sttOnlineProviderContract";
import { STT_ONLINE_RUNTIME_CHANGED_EVENT } from "../services/stt/sttOnlineRuntimeNotify";
import {
  persistTranscribeSource,
  readStoredTranscribeSource,
  type TranscribeSource,
} from "../services/stt/transcribeSource";
import type { ProjectDetail } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import type { useProjectCloseGateController } from "./useProjectCloseGateController";
import type { useProjectEditorState } from "./useProjectEditorState";
import type { useProjectBusyState } from "./useProjectBusyState";
import type { useSegmentMutationController } from "./useSegmentMutationController";
import { postTranscribeCancel } from "./transcribeAsyncPoll";
import { awaitEnvironmentCapabilityRefresh } from "../services/environmentCapabilityCoordinator";
import { resolveTranscribeExecuteBlock } from "./transcribeExecuteGate";
import { segmentsHaveNonEmptyText } from "./transcribeJobHelpers";
import { runLocalTranscribeJob } from "./transcribeLocalJobRun";
import {
  isOnlineTranscribeJobId,
  isSidecarCancellableTranscribeJobId,
  isTranscribeInvokeCancelled,
  isTranscribeUserCancellation,
  newOnlineTranscribeJobId,
  snapshotSegmentsForRestore,
  TRANSCRIBE_CANCELLED_HINT,
  type TranscribeProgress,
} from "./transcribePreviewState";

export type LocalTranscribePreflight = () => string | null;

type CloseGate = Pick<
  ReturnType<typeof useProjectCloseGateController>,
  "openFileWrapped"
>;
type Editor = Pick<
  ReturnType<typeof useProjectEditorState>,
  "current" | "currentFileId" | "segments" | "segmentsRef" | "setCurrent" | "setSegments"
>;
type Busy = Pick<ReturnType<typeof useProjectBusyState>, "busy" | "beginBusy" | "endBusy">;
type Mutations = Pick<ReturnType<typeof useSegmentMutationController>, "resetMutationHistory">;

type Deps = {
  busy: Busy["busy"];
  beginBusy: Busy["beginBusy"];
  endBusy: Busy["endBusy"];
  current: Editor["current"];
  currentFileId: Editor["currentFileId"];
  segments: Editor["segments"];
  segmentsRef: Editor["segmentsRef"];
  setCurrent: Editor["setCurrent"];
  setSegments: Editor["setSegments"];
  setError: (msg: string) => void;
  closeGate: CloseGate;
  mutations: Mutations;
  localTranscribePreflight: LocalTranscribePreflight;
  sttOnlineRuntimeEpoch?: number;
  clearScheduledAutoSave?: () => void;
  onTranscribeSuccess?: (out: p1.RunTranscribeOutcome) => void;
};

export function useTranscribeJobController(deps: Deps) {
  const {
    busy,
    beginBusy,
    endBusy,
    current,
    currentFileId,
    segments,
    segmentsRef,
    setCurrent,
    setSegments,
    setError,
    closeGate,
    mutations,
    localTranscribePreflight,
    sttOnlineRuntimeEpoch = 0,
    clearScheduledAutoSave,
    onTranscribeSuccess,
  } = deps;

  const [transcribeHints, setTranscribeHints] = useState<string[]>([]);
  const [transcribeWarnings, setTranscribeWarnings] = useState<string[]>([]);
  const [transcribeVocabularyPreflightLines, setTranscribeVocabularyPreflightLines] = useState<
    string[]
  >([]);
  const [transcribeStartDialogOpen, setTranscribeStartDialogOpen] = useState(false);
  const [transcribeSource, setTranscribeSourceState] = useState<TranscribeSource>(readStoredTranscribeSource);
  const [transcribeProgress, setTranscribeProgress] = useState<TranscribeProgress | null>(null);
  const [transcribeCancelling, setTranscribeCancelling] = useState(false);
  const [transcribeFailureDiag, setTranscribeFailureDiag] =
    useState<TranscribeTimelineSnapshot | null>(null);
  const [sttRuntimeRevision, setSttRuntimeRevision] = useState(0);

  useEffect(() => {
    const bump = () => setSttRuntimeRevision((n) => n + 1);
    window.addEventListener(STT_ONLINE_RUNTIME_CHANGED_EVENT, bump);
    return () => window.removeEventListener(STT_ONLINE_RUNTIME_CHANGED_EVENT, bump);
  }, []);

  const activeJobIdRef = useRef<string | null>(null);
  const userCancelRequestedRef = useRef(false);
  const transcribeStartedAtRef = useRef(0);
  const firstSegmentsLoggedRef = useRef(false);
  const pollAbortRef = useRef<AbortController | null>(null);

  const refreshVocabularyPreflight = useCallback(async () => {
    try {
      const summary = await loadTranscribeVocabularyPreflight(transcribeSource);
      setTranscribeVocabularyPreflightLines(formatTranscribeVocabularyPreflightLines(summary));
    } catch {
      setTranscribeVocabularyPreflightLines([]);
    }
  }, [transcribeSource]);

  useEffect(() => {
    if (!currentFileId) {
      setTranscribeVocabularyPreflightLines([]);
      return;
    }
    void refreshVocabularyPreflight();
  }, [currentFileId, sttOnlineRuntimeEpoch, sttRuntimeRevision, transcribeSource, refreshVocabularyPreflight]);

  const onlineTranscribeReady = useMemo(
    () => isOnlineTranscribeReady(),
    [sttOnlineRuntimeEpoch, sttRuntimeRevision],
  );

  useEffect(() => {
    if (transcribeSource === "online" && !onlineTranscribeReady) {
      setTranscribeSourceState("local");
      persistTranscribeSource("local");
    }
  }, [onlineTranscribeReady, transcribeSource]);

  const setTranscribeSource = useCallback((source: TranscribeSource) => {
    setTranscribeSourceState(source);
    persistTranscribeSource(source);
  }, []);

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

  const finishTranscribeSuccess = useCallback(
    async (fileId: string, out: p1.RunTranscribeOutcome) => {
      mutations.resetMutationHistory();
      const projectDetail = await p1.projectLoad(current!.id);
      setCurrent(projectDetail);
      const segments = out.detail.segments;
      // 转写开始时 UI 会清空 segments 并标记 dirty；须先写回结果再 openFile，
      // 否则 openFileWrapped 对同文件 noop-same-file-dirty，界面会一直空白。
      segmentsRef.current = segments;
      setSegments(segments);
      onTranscribeSuccess?.(out);
      await closeGate.openFileWrapped(fileId);
      setTranscribeWarnings(out.warnings ?? []);
      const diagSnap = out.transcribeTimeline ?? (await p1.getLastTranscribeTimeline().catch(() => null));
      setTranscribeFailureDiag(null);
      const diagLines = formatTranscribeDiagSummary(diagSnap);
      setTranscribeHints([
        ...deriveTranscribeHints(out.engine ?? "", out.warnings ?? [], segments),
        ...diagLines,
      ]);
      const elapsedMs = Date.now() - (transcribeStartedAtRef.current ?? Date.now());
      const summary = buildTranscribeResultSummary({
        segmentCount: segments.length,
        charCount: countTranscribeCharacters(segments),
        elapsedMs,
      });
      pushTranscribeResultToast(summary);
    },
    [closeGate, current, mutations, onTranscribeSuccess, segmentsRef, setCurrent, setSegments],
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
    segmentsRef.current = [];
    setSegments([]);
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
      } else {
        const requestId = newOnlineTranscribeJobId();
        activeJobIdRef.current = requestId;
        out = await p1.projectRunTranscribe(fileId, asrBaseUrl(), online ?? null, requestId);
      }
      await finishTranscribeSuccess(fileId, out);
    } catch (e) {
      segmentsRef.current = restoreSnapshot;
      setSegments(restoreSnapshot);
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
    finishTranscribeSuccess,
    beginBusy,
    endBusy,
    setError,
    setSegments,
    segmentsRef,
    localTranscribePreflight,
    clearScheduledAutoSave,
    transcribeSource,
  ]);

  const requestTranscribe = useCallback(async () => {
    if (busy) return;
    if (!current || !currentFileId) {
      setError("请先打开一个文件后再自动转录");
      return;
    }
    await refreshVocabularyPreflight();
    setTranscribeStartDialogOpen(true);
  }, [busy, current, currentFileId, refreshVocabularyPreflight, setError]);

  const cancelTranscribeStart = useCallback(() => {
    if (busy) return;
    setTranscribeStartDialogOpen(false);
  }, [busy]);

  const confirmTranscribeStart = useCallback(async () => {
    setTranscribeStartDialogOpen(false);
    await executeTranscribe();
  }, [executeTranscribe]);

  const cancelTranscribeOverwrite = cancelTranscribeStart;
  const confirmTranscribeOverwrite = () => {
    void confirmTranscribeStart();
  };

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
  }, []);

  return {
    transcribeHints,
    transcribeWarnings,
    setTranscribeHints,
    setTranscribeWarnings,
    transcribeProgress,
    transcribeCancelling,
    transcribeFailureDiag,
    setTranscribeFailureDiag,
    transcribeStartDialogOpen,
    transcribeStartHasExistingText: segmentsHaveNonEmptyText(segmentsRef.current),
    /** @deprecated Use transcribeStartDialogOpen */
    overwriteDialogOpen: transcribeStartDialogOpen,
    overwriteSegmentCount: segments.length,
    transcribeVocabularyPreflightLines,
    transcribeSource,
    setTranscribeSource,
    onlineTranscribeReady,
    requestTranscribe,
    cancelTranscribe,
    cancelTranscribeStart,
    confirmTranscribeStart,
    cancelTranscribeOverwrite,
    confirmTranscribeOverwrite,
    applyDetailClearTranscribe: applyDetail,
  };
}
