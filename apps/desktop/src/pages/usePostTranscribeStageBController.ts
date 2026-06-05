import { useCallback, useMemo, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { postprocessCancelAutoPunctuate } from "../tauri/postprocessApi";
import {
  isLlmRuntimeReady,
  llmConfigHint,
  markLlmConnectionVerified,
  resolveAutoPunctuateBlockReason,
  tryBuildPostprocessRuntimeBridge,
} from "../services/postprocess/postprocessRuntimeContract";
import { TRANSCRIBE_PREVIEW_BLOCK_REASON } from "./transcribePreviewState";
import {
  countStageBPunctuateSteps,
  estimateStageBProgressTotal,
  runPostTranscribeStageBPreview,
  type PostTranscribeStageBSegmentChange,
} from "../services/postprocess/postTranscribeStageB";

const STAGE_B_CONSENT_KEY = "rushi:auto-punctuate-consent:v1";

export type PostTranscribeStageBDialogState =
  | { phase: "closed" }
  | { phase: "blocked"; reason: string }
  | { phase: "consent"; segmentCount: number }
  | { phase: "loading"; done: number; total: number; punctuateSteps: number }
  | {
      phase: "preview";
      changes: PostTranscribeStageBSegmentChange[];
      selectedSegmentIdxs: number[];
      provider: string;
      rejectedBoundaryOps: number;
      typoStepError: string | null;
    }
  | { phase: "empty"; typoStepError: string | null };

type Args = {
  busy: boolean;
  transcribePreviewActive?: boolean;
  currentFileId: string | null;
  segments: SegmentDto[];
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  flushSegmentTextDrafts: () => void;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  pushUndo: () => void;
  setError: (msg: string) => void;
  saveSegments: (options?: { quiet?: boolean }) => Promise<boolean>;
  llmRuntimeEpoch?: number;
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
    pushUndo,
    setError,
    saveSegments,
    llmRuntimeEpoch = 0,
  } = args;

  const [dialog, setDialog] = useState<PostTranscribeStageBDialogState>({ phase: "closed" });
  const activeRequestSeqRef = useRef(0);
  const activeRequestIdRef = useRef<string | null>(null);

  const hasSegmentText = segments.some((s) => (s.text ?? "").trim().length > 0);
  const stageBBlockReason = useMemo(() => {
    if (transcribePreviewActive) return TRANSCRIBE_PREVIEW_BLOCK_REASON;
    return resolveAutoPunctuateBlockReason({
      currentFileId,
      hasSegmentText,
      keychainReady: true,
      keychainChecking: false,
      llmCapabilityOk: isLlmRuntimeReady() ? true : undefined,
      llmCapabilityBlockReason: isLlmRuntimeReady() ? null : "请在设置 → LLM 配置 中完成探测后再使用改稿。",
    });
  }, [transcribePreviewActive, currentFileId, hasSegmentText, llmRuntimeEpoch]);

  const canOfferPostTranscribeStageB =
    !busy && !transcribePreviewActive && !!currentFileId && hasSegmentText && stageBBlockReason === null;

  const startPreview = useCallback(async () => {
    if (!currentFileId) return;
    const runtime = tryBuildPostprocessRuntimeBridge();
    if (!runtime) {
      setError(llmConfigHint());
      setDialog({ phase: "blocked", reason: llmConfigHint() });
      return;
    }
    flushSegmentTextDrafts();
    setError("");
    const seq = activeRequestSeqRef.current + 1;
    activeRequestSeqRef.current = seq;
    const punctuateSteps = countStageBPunctuateSteps(segmentsRef.current);
    setDialog({
      phase: "loading",
      done: 0,
      total: estimateStageBProgressTotal({ segments: segmentsRef.current, runtime }),
      punctuateSteps,
    });
    try {
      const out = await runPostTranscribeStageBPreview({
        segments: segmentsRef.current,
        runtime,
        onProgress: (done, total) => {
          if (activeRequestSeqRef.current !== seq) return;
          setDialog({ phase: "loading", done, total, punctuateSteps });
        },
      });
      if (activeRequestSeqRef.current !== seq) return;
      markLlmConnectionVerified();
      if (!out.changes.length) {
        setDialog({
          phase: "empty",
          typoStepError: out.typoStepError,
        });
        return;
      }
      setDialog({
        phase: "preview",
        changes: out.changes,
        selectedSegmentIdxs: out.changes.map((c) => c.segmentIdx),
        provider: out.provider,
        rejectedBoundaryOps: out.rejectedBoundaryOps,
        typoStepError: out.typoStepError,
      });
    } catch (e) {
      if (activeRequestSeqRef.current !== seq) return;
      setDialog({ phase: "closed" });
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [currentFileId, flushSegmentTextDrafts, segmentsRef, setError]);

  const offerStageB = useCallback(() => {
    if (!canOfferPostTranscribeStageB) {
      if (stageBBlockReason) {
        setDialog({ phase: "blocked", reason: stageBBlockReason });
      }
      return;
    }
    setError("");
    const count = segmentsRef.current.filter((s) => (s.text ?? "").trim()).length;
    if (window.localStorage.getItem(STAGE_B_CONSENT_KEY) !== "accepted") {
      setDialog({ phase: "consent", segmentCount: count });
      return;
    }
    void startPreview();
  }, [canOfferPostTranscribeStageB, segmentsRef, setError, stageBBlockReason, startPreview]);

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

  const confirmStageBWriteback = useCallback(async () => {
    if (dialog.phase !== "preview") return;
    if (dialog.selectedSegmentIdxs.length === 0) return;
    flushSegmentTextDrafts();
    pushUndo();
    const selected = new Set(dialog.selectedSegmentIdxs);
    const next = [...segmentsRef.current];
    for (const ch of dialog.changes) {
      if (!selected.has(ch.segmentIdx)) continue;
      const row = next[ch.segmentIdx];
      if (row) next[ch.segmentIdx] = { ...row, text: ch.afterText };
    }
    segmentsRef.current = next;
    setSegments(next);
    setDialog({ phase: "closed" });
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
    if (requestId) {
      void postprocessCancelAutoPunctuate(requestId).catch(() => {
        /* ignore */
      });
    }
  }, []);

  const dismissStageBBlocked = useCallback(() => {
    setDialog({ phase: "closed" });
  }, []);

  return {
    canOfferPostTranscribeStageB,
    postTranscribeStageBBlockReason: stageBBlockReason,
    postTranscribeStageBDialog: dialog,
    offerPostTranscribeStageB: offerStageB,
    confirmPostTranscribeStageBConsent: confirmStageBConsent,
    confirmPostTranscribeStageBWriteback: confirmStageBWriteback,
    togglePostTranscribeStageBSegment: toggleStageBSegment,
    cancelPostTranscribeStageB: cancelStageB,
    dismissPostTranscribeStageBBlocked: dismissStageBBlocked,
  };
}
