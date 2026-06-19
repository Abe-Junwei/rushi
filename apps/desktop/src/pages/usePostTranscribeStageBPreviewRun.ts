import { useCallback } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  llmConfigHint,
  markLlmConnectionVerified,
  tryBuildPostprocessRuntimeBridge,
} from "../services/postprocess/postprocessRuntimeContract";
import { ensureStageBLlmActionReady } from "../services/postprocess/stageBLlmGate";
import { toast } from "../services/ui/toast";
import {
  estimateStageBProgressTotal,
  runPostTranscribeStageBPreview,
} from "../services/postprocess/postTranscribeStageB";
import type { PostTranscribeStageBDialogState } from "./postTranscribeStageBTypes";
import type { BusyReason } from "./useProjectCrudController";

type Args = {
  currentFileId: string | null;
  hasSegmentText: boolean;
  getCurrentSegmentsSnapshot: () => SegmentDto[];
  flushSegmentTextDrafts: () => void;
  setError: (msg: string) => void;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
  setDialog: React.Dispatch<React.SetStateAction<PostTranscribeStageBDialogState>>;
  setPreviewFocusSegmentIdx: React.Dispatch<React.SetStateAction<number | null>>;
  activeRequestSeqRef: React.MutableRefObject<number>;
  activeRequestIdRef: React.MutableRefObject<string | null>;
  pendingStageAHintRef: React.MutableRefObject<string | null>;
};

export function usePostTranscribeStageBPreviewRun(args: Args) {
  const {
    currentFileId,
    hasSegmentText,
    getCurrentSegmentsSnapshot,
    flushSegmentTextDrafts,
    setError,
    beginBusy,
    endBusy,
    setDialog,
    setPreviewFocusSegmentIdx,
    activeRequestSeqRef,
    activeRequestIdRef,
    pendingStageAHintRef,
  } = args;

  /* eslint-disable react-hooks/exhaustive-deps -- pendingStageAHintRef is a stable ref used only inside the callback */
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
    const currentSegments = getCurrentSegmentsSnapshot();
    const total = estimateStageBProgressTotal({ segments: currentSegments, runtime });
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
        segments: currentSegments,
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
        dropDetail: out.dropDetail,
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
  }, [
    activeRequestIdRef,
    activeRequestSeqRef,
    beginBusy,
    currentFileId,
    endBusy,
    flushSegmentTextDrafts,
    getCurrentSegmentsSnapshot,
    hasSegmentText,
    setDialog,
    setError,
    setPreviewFocusSegmentIdx,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return { startPreview };
}
