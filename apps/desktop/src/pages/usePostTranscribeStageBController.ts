import { useCallback, useMemo, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { postprocessCancelAutoPunctuate } from "../tauri/postprocessApi";
import {
  llmConfigHint,
  markLlmConnectionVerified,
  tryBuildPostprocessRuntimeBridge,
} from "../services/postprocess/postprocessRuntimeContract";
import {
  ensureStageBLlmActionReady,
  readStageBLlmGateSnapshot,
  resolveStageBSyncBlockReason,
} from "../services/postprocess/stageBLlmGate";
import { resolvePendingStageAHint } from "../services/postprocess/stageBPendingRulesHint";
import { toast } from "../services/ui/toast";
import { scrollSegmentListIndexToView } from "../utils/segmentListVirtualWindow";
import { findSegmentIndexByUid } from "./segmentListHelpers";
import type { BusyReason } from "./useProjectCrudController";
import { TRANSCRIBE_PREVIEW_BLOCK_REASON } from "./transcribePreviewState";
import {
  countStageBProofreadBatches,
  estimateStageBProgressTotal,
  runPostTranscribeStageBPreview,
} from "../services/postprocess/postTranscribeStageB";
import type { PostTranscribeStageBDialogState } from "./postTranscribeStageBTypes";
import { STAGE_B_CONSENT_KEY } from "./postTranscribeStageBTypes";
export type { PostTranscribeStageBDialogState } from "./postTranscribeStageBTypes";

type Args = {
  busy: boolean;
  transcribePreviewActive?: boolean;
  currentFileId: string | null;
  segments: SegmentDto[];
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  flushSegmentTextDrafts: () => void;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  pushUndo: () => void;
  setError: (msg: string) => void;
  saveSegments: (options?: { quiet?: boolean }) => Promise<boolean>;
  llmRuntimeEpoch?: number;
  llmEnvRevision?: string;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
};

export function usePostTranscribeStageBController(args: Args) {
  const {
    busy,
    transcribePreviewActive = false,
    currentFileId,
    segments,
    segmentsRef,
    flushSegmentTextDrafts,
    setSegments,
    setSelectedIdx,
    pushUndo,
    setError,
    saveSegments,
    llmRuntimeEpoch = 0,
    llmEnvRevision = "",
    beginBusy,
    endBusy,
  } = args;

  const [dialog, setDialog] = useState<PostTranscribeStageBDialogState>({ phase: "closed" });
  const [previewFocusSegmentIdx, setPreviewFocusSegmentIdx] = useState<number | null>(null);
  const activeRequestSeqRef = useRef(0);
  const activeRequestIdRef = useRef<string | null>(null);
  const pendingStageAHintRef = useRef<string | null>(null);

  const hasSegmentText = segments.some((s) => (s.text ?? "").trim().length > 0);
  const llmGate = useMemo(
    () => readStageBLlmGateSnapshot(),
    [llmRuntimeEpoch, llmEnvRevision],
  );

  const stageBBlockReason = useMemo(() => {
    if (transcribePreviewActive) return TRANSCRIBE_PREVIEW_BLOCK_REASON;
    return resolveStageBSyncBlockReason({ currentFileId, hasSegmentText });
  }, [
    transcribePreviewActive,
    currentFileId,
    hasSegmentText,
    llmGate,
    llmRuntimeEpoch,
    llmEnvRevision,
  ]);

  const isStageBDialogOpen = dialog.phase !== "closed";

  const canOfferPostTranscribeStageB =
    !busy &&
    !transcribePreviewActive &&
    !isStageBDialogOpen &&
    !!currentFileId &&
    hasSegmentText &&
    stageBBlockReason === null &&
    llmGate.llmCapabilityOk;

  const startPreview = useCallback(async () => {
    if (!currentFileId) return;
    const actionBlockReason = await ensureStageBLlmActionReady({
      currentFileId,
      hasSegmentText,
    });
    if (actionBlockReason) {
      toast.warning(actionBlockReason);
      return;
    }
    const runtime = tryBuildPostprocessRuntimeBridge();
    if (!runtime) {
      toast.warning(llmConfigHint());
      return;
    }
    flushSegmentTextDrafts();
    setError("");
    const seq = activeRequestSeqRef.current + 1;
    activeRequestSeqRef.current = seq;
    const pendingStageAHint = pendingStageAHintRef.current;
    const total = estimateStageBProgressTotal({ segments: segmentsRef.current, runtime });
    setPreviewFocusSegmentIdx(null);
    setDialog({
      phase: "loading",
      done: 0,
      total,
      providerLabel: runtime.provider,
      pendingStageAHint,
    });
    beginBusy("stage_b");
    try {
      const out = await runPostTranscribeStageBPreview({
        segments: segmentsRef.current,
        runtime,
        shouldContinue: () => activeRequestSeqRef.current === seq,
        onActiveRequestId: (requestId) => {
          if (activeRequestSeqRef.current !== seq) return;
          activeRequestIdRef.current = requestId;
        },
        onProgress: (done, progressTotal) => {
          if (activeRequestSeqRef.current !== seq) return;
          setDialog({
            phase: "loading",
            done,
            total: progressTotal,
            providerLabel: runtime.provider,
            pendingStageAHint,
          });
        },
      });
      if (activeRequestSeqRef.current !== seq) return;
      activeRequestIdRef.current = null;
      if (out.changes.length > 0 || !out.typoStepError) {
        markLlmConnectionVerified();
      }
      if (!out.changes.length) {
        setDialog({
          phase: "empty",
          stepError: out.typoStepError,
          pendingStageAHint,
          packTruncationHint: out.packTruncationHint,
        });
        return;
      }
      setDialog({
        phase: "preview",
        changes: out.changes,
        selectedSegmentIdxs: out.changes.map((c) => c.segmentIdx),
        provider: out.provider,
        droppedUngroundedOps: out.droppedUngroundedOps,
        stepError: out.typoStepError,
        pendingStageAHint,
        packTruncationHint: out.packTruncationHint,
      });
    } catch (e) {
      if (activeRequestSeqRef.current !== seq) return;
      setDialog({ phase: "closed" });
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (activeRequestSeqRef.current === seq) {
        endBusy();
      }
    }
  }, [beginBusy, currentFileId, endBusy, flushSegmentTextDrafts, hasSegmentText, segmentsRef, setError]);

  const offerStageB = useCallback(async () => {
    if (isStageBDialogOpen) return;

    const freshBlockReason = transcribePreviewActive
      ? TRANSCRIBE_PREVIEW_BLOCK_REASON
      : resolveStageBSyncBlockReason({ currentFileId, hasSegmentText });
    const freshGate = readStageBLlmGateSnapshot();
    const canRunNow =
      !busy &&
      !transcribePreviewActive &&
      !!currentFileId &&
      hasSegmentText &&
      freshBlockReason === null &&
      freshGate.llmCapabilityOk;

    if (!canRunNow) {
      const reason =
        freshBlockReason ??
        freshGate.llmCapabilityBlockReason ??
        llmConfigHint();
      toast.warning(reason);
      return;
    }

    const actionBlockReason = await ensureStageBLlmActionReady({
      currentFileId,
      hasSegmentText,
    });
    if (actionBlockReason) {
      toast.warning(actionBlockReason);
      return;
    }

    setError("");
    const count = segmentsRef.current.filter((s) => (s.text ?? "").trim()).length;
    const pendingStageAHint = await resolvePendingStageAHint(segmentsRef.current).catch(() => null);
    pendingStageAHintRef.current = pendingStageAHint;
    if (window.localStorage.getItem(STAGE_B_CONSENT_KEY) !== "accepted") {
      setDialog({ phase: "consent", segmentCount: count, pendingStageAHint });
      return;
    }
    void startPreview();
  }, [
    busy,
    currentFileId,
    hasSegmentText,
    isStageBDialogOpen,
    segmentsRef,
    setError,
    startPreview,
    transcribePreviewActive,
  ]);

  const confirmStageBConsent = useCallback(() => {
    window.localStorage.setItem(STAGE_B_CONSENT_KEY, "accepted");
    void startPreview();
  }, [startPreview]);

  const toggleStageBSegment = useCallback((segmentIdx: number) => {
    setDialog((prev) => {
      if (prev.phase !== "preview") return prev;
      const selected = new Set(prev.selectedSegmentIdxs);
      if (selected.has(segmentIdx)) selected.delete(segmentIdx);
      else selected.add(segmentIdx);
      return { ...prev, selectedSegmentIdxs: [...selected].sort((a, b) => a - b) };
    });
  }, []);

  const focusStageBSegment = useCallback(
    (segmentIdx: number) => {
      setPreviewFocusSegmentIdx(segmentIdx);
      setSelectedIdx(segmentIdx);
      scrollSegmentListIndexToView(segmentIdx);
    },
    [setSelectedIdx],
  );

  const confirmStageBWriteback = useCallback(async () => {
    if (dialog.phase !== "preview") return;
    if (dialog.selectedSegmentIdxs.length === 0) return;
    flushSegmentTextDrafts();
    pushUndo();
    const selected = new Set(dialog.selectedSegmentIdxs);
    const next = [...segmentsRef.current];
    let applied = 0;
    for (const ch of dialog.changes) {
      if (!selected.has(ch.segmentIdx)) continue;
      const idx = ch.uid.trim()
        ? findSegmentIndexByUid(next, ch.uid)
        : ch.segmentIdx;
      if (idx < 0) continue;
      const row = next[idx];
      if (!row) continue;
      next[idx] = { ...row, text: ch.afterText };
      applied += 1;
    }
    if (applied === 0) {
      setError("所选语段已不存在或 uid 已变化，请关闭预览后重新生成候选。");
      return;
    }
    segmentsRef.current = next;
    setSegments(next);
    setDialog({ phase: "closed" });
    setPreviewFocusSegmentIdx(null);
    const saved = await saveSegments({ quiet: true });
    if (!saved) {
      setError("改稿预览已写回，但保存失败，请稍后手动保存。");
    }
  }, [dialog, flushSegmentTextDrafts, pushUndo, saveSegments, segmentsRef, setError, setSegments]);

  const cancelStageB = useCallback(() => {
    activeRequestSeqRef.current += 1;
    const requestId = activeRequestIdRef.current;
    activeRequestIdRef.current = null;
    setDialog({ phase: "closed" });
    setPreviewFocusSegmentIdx(null);
    endBusy();
    if (requestId) {
      void postprocessCancelAutoPunctuate(requestId).catch(() => {
        /* ignore */
      });
    }
  }, [endBusy]);

  return {
    canOfferPostTranscribeStageB,
    postTranscribeStageBBlockReason: stageBBlockReason,
    postTranscribeStageBDialog: dialog,
    postTranscribeStageBPreviewFocusSegmentIdx: previewFocusSegmentIdx,
    offerPostTranscribeStageB: offerStageB,
    confirmPostTranscribeStageBConsent: confirmStageBConsent,
    confirmPostTranscribeStageBWriteback: confirmStageBWriteback,
    togglePostTranscribeStageBSegment: toggleStageBSegment,
    focusPostTranscribeStageBSegment: focusStageBSegment,
    cancelPostTranscribeStageB: cancelStageB,
    countStageBProofreadBatches,
    isPostTranscribeStageBDialogOpen: isStageBDialogOpen,
  };
}
