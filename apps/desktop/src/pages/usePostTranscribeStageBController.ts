import { useCallback, useMemo, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { postprocessCancelAutoPunctuate } from "../tauri/postprocessApi";
import {
  llmConfigHint,
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
import { applyAiRevisedStageToUids } from "../services/segmentStagePersist";
import type { SegmentPublishApi } from "./segmentPublishApi";
import type { BusyReason } from "./useProjectCrudController";
import { TRANSCRIBE_PREVIEW_BLOCK_REASON } from "./transcribePreviewState";
import { countStageBProofreadBatches } from "../services/postprocess/postTranscribeStageB";
import type { PostTranscribeStageBDialogState } from "./postTranscribeStageBTypes";
import { STAGE_B_CONSENT_KEY } from "./postTranscribeStageBTypes";
import { usePostTranscribeStageBPreviewRun } from "./usePostTranscribeStageBPreviewRun";

export type { PostTranscribeStageBDialogState } from "./postTranscribeStageBTypes";

type Args = {
  busy: boolean;
  transcribePreviewActive?: boolean;
  currentFileId: string | null;
  segments: SegmentDto[];
  segmentPublish: SegmentPublishApi;
  flushSegmentTextDrafts: () => void;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  pushUndo: () => void;
  setError: (msg: string) => void;
  saveSegments: (options?: {
    quiet?: boolean;
    countHits?: boolean;
    aiRevisedUids?: ReadonlySet<string>;
  }) => Promise<boolean>;
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
    segmentPublish,
    flushSegmentTextDrafts,
    setSelectedIdx,
    pushUndo,
    setError,
    saveSegments,
    llmRuntimeEpoch = 0,
    llmEnvRevision = "",
    beginBusy,
    endBusy,
  } = args;

  const getCurrentSegmentsSnapshot = segmentPublish.getCurrentSegmentsSnapshot;

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

  const { startPreview } = usePostTranscribeStageBPreviewRun({
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
  });

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
    const currentSegments = getCurrentSegmentsSnapshot();
    const count = currentSegments.filter((s) => (s.text ?? "").trim()).length;
    const pendingStageAHint = await resolvePendingStageAHint(currentSegments).catch(() => null);
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
    getCurrentSegmentsSnapshot,
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
    const next = [...getCurrentSegmentsSnapshot()];
    const changedUids = new Set<string>();
    let applied = 0;
    for (const ch of dialog.changes) {
      if (!selected.has(ch.segmentIdx)) continue;
      const idx = ch.uid.trim()
        ? findSegmentIndexByUid(next, ch.uid)
        : ch.segmentIdx;
      if (idx < 0) continue;
      const row = next[idx];
      if (!row) continue;
      if (row.text !== ch.afterText) {
        const uid = row.uid?.trim();
        if (uid) changedUids.add(uid);
      }
      next[idx] = { ...row, text: ch.afterText };
      applied += 1;
    }
    if (applied === 0) {
      setError("所选语段已不存在或 uid 已变化，请关闭预览后重新生成候选。");
      return;
    }
    const staged = applyAiRevisedStageToUids(next, changedUids);
    segmentPublish.publishTextBulk(staged);
    setDialog({ phase: "closed" });
    setPreviewFocusSegmentIdx(null);
    const saved = await saveSegments({ quiet: true, aiRevisedUids: changedUids });
    if (!saved) {
      setError("改稿预览已写回，但保存失败，请稍后手动保存。");
    }
  }, [dialog, flushSegmentTextDrafts, getCurrentSegmentsSnapshot, pushUndo, saveSegments, segmentPublish, setError]);

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
