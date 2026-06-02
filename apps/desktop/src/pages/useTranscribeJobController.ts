import { useCallback, useEffect, useRef, useState } from "react";
import { asrBaseUrl } from "../config/env";
import { deriveTranscribeHints } from "../services/asrTranscribeHints";
import {
  formatTranscribeVocabularyPreflightLines,
  loadTranscribeVocabularyPreflight,
} from "../services/asr/transcribeVocabularyPreflight";
import { pushTranscribeHintsToToast, toast } from "../services/ui/toast";
import { tryBuildOnlineTranscribeBridgePayload } from "../services/stt/sttOnlineProviderContract";
import type { ProjectDetail } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import type { useProjectCloseGateController } from "./useProjectCloseGateController";
import type { useProjectEditorState } from "./useProjectEditorState";
import type { useProjectBusyState } from "./useProjectBusyState";
import type { useSegmentMutationController } from "./useSegmentMutationController";
import { postTranscribeCancel } from "./transcribeAsyncPoll";
import { resolveTranscribeExecuteBlock } from "./transcribeExecuteGate";
import { segmentsHaveNonEmptyText } from "./transcribeJobHelpers";
import { runLocalTranscribeJob } from "./transcribeLocalJobRun";
import {
  isTranscribeUserCancellation,
  snapshotSegmentsForRestore,
  TRANSCRIBE_ASYNC_FALLBACK_HINT,
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
  } = deps;

  const [transcribeHints, setTranscribeHints] = useState<string[]>([]);
  const [transcribeVocabularyPreflightLines, setTranscribeVocabularyPreflightLines] = useState<
    string[]
  >([]);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<TranscribeProgress | null>(null);
  const [transcribeCancelling, setTranscribeCancelling] = useState(false);

  const activeJobIdRef = useRef<string | null>(null);
  const userCancelRequestedRef = useRef(false);
  const transcribeStartedAtRef = useRef(0);
  const firstSegmentsLoggedRef = useRef(false);

  const refreshVocabularyPreflight = useCallback(async () => {
    try {
      const summary = await loadTranscribeVocabularyPreflight();
      setTranscribeVocabularyPreflightLines(formatTranscribeVocabularyPreflightLines(summary));
    } catch {
      setTranscribeVocabularyPreflightLines([]);
    }
  }, []);

  useEffect(() => {
    if (!currentFileId) {
      setTranscribeVocabularyPreflightLines([]);
      return;
    }
    void refreshVocabularyPreflight();
  }, [currentFileId, sttOnlineRuntimeEpoch, refreshVocabularyPreflight]);

  const runRefs = {
    activeJobId: activeJobIdRef,
    userCancelRequested: userCancelRequestedRef,
    transcribeStartedAtMs: transcribeStartedAtRef,
    firstSegmentsLogged: firstSegmentsLoggedRef,
  };

  useEffect(() => {
    return () => {
      activeJobIdRef.current = null;
      userCancelRequestedRef.current = false;
    };
  }, []);

  const finishTranscribeSuccess = useCallback(
    async (fileId: string, out: p1.RunTranscribeOutcome, extraHints: string[] = []) => {
      mutations.resetMutationHistory();
      const projectDetail = await p1.projectLoad(current!.id);
      setCurrent(projectDetail);
      await closeGate.openFileWrapped(fileId);
      const hints = deriveTranscribeHints(out.engine, out.warnings, out.detail.segments);
      hints.push(...extraHints);
      if (import.meta.env.DEV && hints.length > 0) {
        hints.push("（开发模式）详见仓库 services/asr/README.md。");
      }
      setTranscribeHints([]);
      pushTranscribeHintsToToast(hints);
    },
    [closeGate, current, mutations, setCurrent],
  );

  const executeTranscribe = useCallback(async () => {
    const block = resolveTranscribeExecuteBlock({
      busy,
      hasCurrent: !!current,
      currentFileId,
      localTranscribePreflight,
    });
    if (block) {
      if (block !== "busy") toast.error(block);
      return;
    }
    const fileId = currentFileId!;
    setOverwriteDialogOpen(false);
    beginBusy("transcribe");
    setError("");
    setTranscribeHints([]);
    const vocabLine = transcribeVocabularyPreflightLines.find((l) => l.trim());
    if (vocabLine) toast.info(vocabLine);
    setTranscribeProgress(null);
    setTranscribeCancelling(false);
    userCancelRequestedRef.current = false;
    firstSegmentsLoggedRef.current = false;
    transcribeStartedAtRef.current = Date.now();
    const restoreSnapshot = snapshotSegmentsForRestore(segmentsRef.current);
    segmentsRef.current = [];
    setSegments([]);
    try {
      const online = tryBuildOnlineTranscribeBridgePayload();
      const base = asrBaseUrl().replace(/\/+$/, "");
      let out: p1.RunTranscribeOutcome;
      let extraHints: string[] = [];
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
          extraHints = [TRANSCRIBE_ASYNC_FALLBACK_HINT];
        }
      } else {
        out = await p1.projectRunTranscribe(fileId, asrBaseUrl(), online ?? null);
      }
      await finishTranscribeSuccess(fileId, out, extraHints);
    } catch (e) {
      segmentsRef.current = restoreSnapshot;
      setSegments(restoreSnapshot);
      if (isTranscribeUserCancellation(e)) {
        setTranscribeHints([]);
        pushTranscribeHintsToToast([TRANSCRIBE_CANCELLED_HINT]);
      } else {
        toast.error(e instanceof Error ? e.message : String(e));
      }
    } finally {
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
    transcribeVocabularyPreflightLines,
  ]);

  const requestTranscribe = useCallback(async () => {
    const block = resolveTranscribeExecuteBlock({
      busy,
      hasCurrent: !!current,
      currentFileId,
      localTranscribePreflight: () => null,
    });
    if (block) {
      if (block !== "busy") toast.error(block);
      return;
    }
    if (segmentsHaveNonEmptyText(segmentsRef.current)) {
      await refreshVocabularyPreflight();
      setOverwriteDialogOpen(true);
      return;
    }
    await refreshVocabularyPreflight();
    await executeTranscribe();
  }, [busy, current, currentFileId, segmentsRef, setError, executeTranscribe, refreshVocabularyPreflight]);

  const cancelTranscribeOverwrite = useCallback(() => {
    if (busy) return;
    setOverwriteDialogOpen(false);
  }, [busy]);

  const confirmTranscribeOverwrite = useCallback(() => {
    void executeTranscribe();
  }, [executeTranscribe]);

  const cancelTranscribe = useCallback(async () => {
    const jobId = activeJobIdRef.current;
    if (!jobId || transcribeCancelling) return;
    setTranscribeCancelling(true);
    userCancelRequestedRef.current = true;
    const base = asrBaseUrl().replace(/\/+$/, "");
    try {
      await postTranscribeCancel(base, jobId);
    } catch {
      /* poll loop will surface sidecar errors or timeout */
    }
  }, [transcribeCancelling]);

  const applyDetail = useCallback((_d: ProjectDetail) => {
    setTranscribeHints([]);
    setOverwriteDialogOpen(false);
    setTranscribeProgress(null);
    setTranscribeCancelling(false);
  }, []);

  return {
    transcribeHints,
    setTranscribeHints,
    transcribeProgress,
    transcribeCancelling,
    overwriteDialogOpen,
    overwriteSegmentCount: segments.length,
    transcribeVocabularyPreflightLines,
    requestTranscribe,
    cancelTranscribe,
    cancelTranscribeOverwrite,
    confirmTranscribeOverwrite,
    applyDetailClearTranscribe: applyDetail,
  };
}
