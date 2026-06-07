import {
  collectAutoPunctuateNeighborContext,
  neighborContextSummary,
  type NeighborContextItem,
} from "./autoPunctuateNeighbors";
import { useCallback, useMemo, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  llmConfigHint,
  markLlmConnectionVerified,
  resolveAutoPunctuateBlockReason,
  tryBuildPostprocessRuntimeBridge,
} from "../services/postprocess/postprocessRuntimeContract";
import { TRANSCRIBE_PREVIEW_BLOCK_REASON } from "./transcribePreviewState";
import { applySegmentTextChange } from "./segmentTextLearnMeta";
import {
  postprocessCancelAutoPunctuate,
  postprocessAutoPunctuate,
  type PostprocessAutoPunctuateRequest,
} from "../tauri/postprocessApi";
import type { TextDiffSpan } from "../utils/textDiff";

const AUTO_PUNCTUATE_CONSENT_KEY = "rushi:auto-punctuate-consent:v1";

type SegmentTextMutator = (idx: number, text: string) => void;

export type AutoPunctuateDialogState =
  | { phase: "closed" }
  | { phase: "consent"; originalText: string; neighborContextSummary: string | null }
  | { phase: "loading"; originalText: string; neighborContextSummary: string | null }
  | {
      phase: "preview";
      originalText: string;
      candidateText: string;
      diff: TextDiffSpan[];
      provider: string;
      latencyMs: number;
      neighborContextSummary: string | null;
    };

type UseAutoPunctuateControllerArgs = {
  busy: boolean;
  transcribePreviewActive?: boolean;
  currentFileId: string | null;
  selectedIdx: number;
  segments: SegmentDto[];
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  flushSegmentTextDrafts: () => void;
  updateSegmentText: SegmentTextMutator;
  setError: React.Dispatch<React.SetStateAction<string>>;
  llmRuntimeEpoch?: number;
  llmKeychainReady?: boolean;
  llmKeychainChecking?: boolean;
  llmCapabilityOk?: boolean;
  llmCapabilityBlockReason?: string | null;
};

export type AutoPunctuateControllerApi = {
  canAutoPunctuate: boolean;
  autoPunctuateBlockReason: string | null;
  dialog: AutoPunctuateDialogState;
  requestAutoPunctuate: () => void;
  confirmAutoPunctuateConsent: () => void;
  confirmAutoPunctuateWriteback: () => void;
  cancelAutoPunctuate: () => void;
};

type PendingPayload = {
  request: PostprocessAutoPunctuateRequest;
  originalText: string;
  neighborContextSummary: string | null;
};

function createAutoPunctuateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `auto-punctuate-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useAutoPunctuateController(
  args: UseAutoPunctuateControllerArgs,
): AutoPunctuateControllerApi {
  const {
    busy,
    transcribePreviewActive = false,
    currentFileId,
    selectedIdx,
    segments,
    segmentsRef,
    flushSegmentTextDrafts,
    updateSegmentText,
    setError,
    llmRuntimeEpoch = 0,
    llmKeychainReady = false,
    llmKeychainChecking = false,
    llmCapabilityOk,
    llmCapabilityBlockReason = null,
  } = args;

  const [dialog, setDialog] = useState<AutoPunctuateDialogState>({ phase: "closed" });
  const activeRequestSeqRef = useRef(0);
  const activeRequestIdRef = useRef<string | null>(null);
  const pendingPayloadRef = useRef<PendingPayload | null>(null);
  const previewSegmentUidRef = useRef<string | null>(null);

  const selected = segments[selectedIdx] ?? null;
  const autoPunctuateBlockReason = useMemo(
    () => {
      if (transcribePreviewActive) return TRANSCRIBE_PREVIEW_BLOCK_REASON;
      return resolveAutoPunctuateBlockReason({
        currentFileId,
        hasSegmentText: !!(selected?.text ?? "").trim(),
        keychainReady: llmKeychainReady,
        keychainChecking: llmKeychainChecking,
        llmCapabilityOk,
        llmCapabilityBlockReason,
      });
    },
    [
      transcribePreviewActive,
      currentFileId,
      llmCapabilityBlockReason,
      llmCapabilityOk,
      llmKeychainChecking,
      llmKeychainReady,
      llmRuntimeEpoch,
      selected,
    ],
  );
  const canAutoPunctuate =
    !busy &&
    !transcribePreviewActive &&
    !!currentFileId &&
    !!selected &&
    (selected.text ?? "").trim().length > 0 &&
    autoPunctuateBlockReason === null &&
    (llmCapabilityOk ?? true);

  const buildRequest = useCallback((): PendingPayload | null => {
    if (busy || !currentFileId) return null;
    flushSegmentTextDrafts();
    const current = segmentsRef.current[selectedIdx];
    if (!current || !current.uid || !current.text.trim()) {
      setError("请先选中一条有正文的语段。");
      return null;
    }
    const runtime = tryBuildPostprocessRuntimeBridge();
    if (!runtime) {
      setError(llmConfigHint());
      return null;
    }
    const neighbor_context: NeighborContextItem[] = collectAutoPunctuateNeighborContext(
      segmentsRef.current,
      selectedIdx,
    );
    const contextSummary = neighborContextSummary(neighbor_context);
    return {
      originalText: current.text,
      neighborContextSummary: contextSummary,
      request: {
        task: "auto_punctuate",
        request_id: createAutoPunctuateRequestId(),
        segment_uid: current.uid,
        text: current.text,
        neighbor_context,
        runtime,
      },
    };
  }, [busy, currentFileId, flushSegmentTextDrafts, llmRuntimeEpoch, segmentsRef, selectedIdx, setError]);

  const startRequest = useCallback(
    (payload: PendingPayload) => {
      const seq = activeRequestSeqRef.current + 1;
      activeRequestSeqRef.current = seq;
      activeRequestIdRef.current = payload.request.request_id ?? null;
      previewSegmentUidRef.current = payload.request.segment_uid;
      setDialog({
        phase: "loading",
        originalText: payload.originalText,
        neighborContextSummary: payload.neighborContextSummary,
      });
      void postprocessAutoPunctuate(payload.request)
        .then((out) => {
          if (activeRequestSeqRef.current != seq) return;
          activeRequestIdRef.current = null;
          markLlmConnectionVerified();
          setDialog({
            phase: "preview",
            originalText: payload.originalText,
            candidateText: out.text,
            diff: out.diff,
            provider: out.provider,
            latencyMs: out.latency_ms,
            neighborContextSummary: payload.neighborContextSummary,
          });
        })
        .catch((e) => {
          if (activeRequestSeqRef.current != seq) return;
          activeRequestIdRef.current = null;
          setDialog({ phase: "closed" });
          setError(e instanceof Error ? e.message : String(e));
        });
    },
    [setError],
  );

  const requestAutoPunctuate = useCallback(() => {
    const payload = buildRequest();
    if (!payload) return;
    pendingPayloadRef.current = payload;
    const consent = window.localStorage.getItem(AUTO_PUNCTUATE_CONSENT_KEY);
    if (consent !== "accepted") {
      setDialog({
        phase: "consent",
        originalText: payload.originalText,
        neighborContextSummary: payload.neighborContextSummary,
      });
      return;
    }
    startRequest(payload);
  }, [buildRequest, startRequest]);

  const confirmAutoPunctuateConsent = useCallback(() => {
    const payload = pendingPayloadRef.current;
    if (!payload) return;
    window.localStorage.setItem(AUTO_PUNCTUATE_CONSENT_KEY, "accepted");
    startRequest(payload);
  }, [startRequest]);

  const confirmAutoPunctuateWriteback = useCallback(() => {
    if (dialog.phase !== "preview") return;
    const uid = previewSegmentUidRef.current;
    if (!uid) return;
    const idx = segmentsRef.current.findIndex((seg) => seg.uid === uid);
    if (idx < 0) {
      setDialog({ phase: "closed" });
      setError("语段已变化，无法写回自动标点结果，请重新尝试。");
      return;
    }
    const seg = segmentsRef.current[idx];
    if (!seg) {
      setDialog({ phase: "closed" });
      return;
    }
    // 自动标点写回： intentionally 不传 learn（标点不计入 correction_memory）
    applySegmentTextChange(seg, idx, dialog.candidateText, updateSegmentText, { fromLlm: true });
    setDialog({ phase: "closed" });
  }, [dialog, segmentsRef, updateSegmentText, setError]);

  const cancelAutoPunctuate = useCallback(() => {
    activeRequestSeqRef.current += 1;
    const requestId = activeRequestIdRef.current;
    activeRequestIdRef.current = null;
    pendingPayloadRef.current = null;
    setDialog({ phase: "closed" });
    if (requestId) {
      void postprocessCancelAutoPunctuate(requestId).catch(() => {
        /* ignore */
      });
    }
  }, []);

  return {
    canAutoPunctuate,
    autoPunctuateBlockReason,
    dialog,
    requestAutoPunctuate,
    confirmAutoPunctuateConsent,
    confirmAutoPunctuateWriteback,
    cancelAutoPunctuate,
  };
}
