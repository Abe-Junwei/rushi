import { useCallback, useMemo, useRef, useState } from "react";
import { publishSegmentTextBulkMutation } from "./flushSegmentTextDrafts";
import type { SegmentDto } from "../tauri/projectApi";
import {
  postprocessCancelAutoPunctuate,
  postprocessRefineSegments,
  type PostprocessRefineSegmentsRequest,
  type SegmentRefineOp,
} from "../tauri/postprocessApi";
import {
  collectRefineSegmentWindow,
  describeRefineOpsForPreview,
  validateRefineOps,
} from "../services/postprocess/postprocessSegmentOps";
import {
  applySegmentRefineOps,
  segmentsMonotonicByTime,
} from "../services/postprocess/segmentRefineApply";
import {
  isLlmRuntimeReady,
  llmConfigHint,
  markLlmConnectionVerified,
  resolveAutoPunctuateBlockReason,
  tryBuildPostprocessRuntimeBridge,
} from "../services/postprocess/postprocessRuntimeContract";
import { TRANSCRIBE_PREVIEW_BLOCK_REASON } from "./transcribePreviewState";
import { findSegmentIndexByUid } from "./segmentListHelpers";

const LLM_CONSENT_KEY = "rushi:auto-punctuate-consent:v1";

export type SegmentRefineDialogState =
  | { phase: "closed" }
  | { phase: "consent"; segmentCount: number; opSummary: string | null }
  | { phase: "loading"; segmentCount: number }
  | {
      phase: "preview";
      ops: SegmentRefineOp[];
      opLabels: string[];
      rationale: string | null;
      provider: string;
      latencyMs: number;
      beforeCount: number;
      afterCount: number;
    };

type UseSegmentRefineControllerArgs = {
  busy: boolean;
  transcribePreviewActive?: boolean;
  currentFileId: string | null;
  selectedIdx: number;
  segments: SegmentDto[];
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  flushSegmentTextDrafts: () => void;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  setSelectedIdx: React.Dispatch<React.SetStateAction<number>>;
  pushUndo: () => void;
  setError: React.Dispatch<React.SetStateAction<string>>;
  llmRuntimeEpoch?: number;
  llmKeychainReady?: boolean;
  llmKeychainChecking?: boolean;
  llmCapabilityOk?: boolean;
  llmCapabilityBlockReason?: string | null;
};

export type SegmentRefineControllerApi = {
  canRefineSegments: boolean;
  segmentRefineBlockReason: string | null;
  segmentRefineDialog: SegmentRefineDialogState;
  requestSegmentRefine: () => void;
  confirmSegmentRefineConsent: () => void;
  confirmSegmentRefineWriteback: () => void;
  cancelSegmentRefine: () => void;
};

type PendingPayload = {
  request: PostprocessRefineSegmentsRequest;
  windowUids: string[];
};

function createRefineRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `segment-refine-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useSegmentRefineController(
  args: UseSegmentRefineControllerArgs,
): SegmentRefineControllerApi {
  const {
    busy,
    transcribePreviewActive = false,
    currentFileId,
    selectedIdx,
    segments,
    segmentsRef,
    flushSegmentTextDrafts,
    setSegments,
    setSelectedIdx,
    pushUndo,
    setError,
    llmRuntimeEpoch = 0,
    llmKeychainReady = false,
    llmKeychainChecking = false,
    llmCapabilityOk,
    llmCapabilityBlockReason = null,
  } = args;

  const [dialog, setDialog] = useState<SegmentRefineDialogState>({ phase: "closed" });
  const activeRequestSeqRef = useRef(0);
  const activeRequestIdRef = useRef<string | null>(null);
  const pendingPayloadRef = useRef<PendingPayload | null>(null);
  const previewWindowUidsRef = useRef<string[]>([]);
  const previewOpsRef = useRef<SegmentRefineOp[]>([]);

  const selected = segments[selectedIdx] ?? null;
  const segmentRefineBlockReason = useMemo(() => {
    if (transcribePreviewActive) return TRANSCRIBE_PREVIEW_BLOCK_REASON;
    const base = resolveAutoPunctuateBlockReason({
      currentFileId,
      hasSegmentText: !!(selected?.text ?? "").trim(),
      keychainReady: llmKeychainReady,
      keychainChecking: llmKeychainChecking,
      llmCapabilityOk,
      llmCapabilityBlockReason,
    });
    if (base) return base;
    if (!selected?.uid?.trim()) return "当前语段缺少 uid，无法整理段界。";
    const window = collectRefineSegmentWindow(segments, selectedIdx);
    if (window.length === 0) return "请先选中一条有正文的语段。";
    return null;
  }, [
    transcribePreviewActive,
    currentFileId,
    llmKeychainChecking,
    llmKeychainReady,
    llmCapabilityBlockReason,
    llmCapabilityOk,
    llmRuntimeEpoch,
    selected,
    segments,
    selectedIdx,
  ]);

  const canRefineSegments =
    !busy &&
    !transcribePreviewActive &&
    !!currentFileId &&
    segmentRefineBlockReason === null &&
    (llmCapabilityOk ?? isLlmRuntimeReady());

  const buildPayload = useCallback((): PendingPayload | null => {
    if (busy || !currentFileId) return null;
    flushSegmentTextDrafts();
    const window = collectRefineSegmentWindow(segmentsRef.current, selectedIdx);
    if (window.length === 0) {
      setError("请先选中一条有正文的语段。");
      return null;
    }
    const runtime = tryBuildPostprocessRuntimeBridge();
    if (!runtime) {
      setError(llmConfigHint());
      return null;
    }
    return {
      windowUids: window.map((s) => s.uid),
      request: {
        task: "refine_segments",
        request_id: createRefineRequestId(),
        segments: window,
        runtime,
      },
    };
  }, [busy, currentFileId, flushSegmentTextDrafts, llmRuntimeEpoch, segmentsRef, selectedIdx, setError]);

  const startRequest = useCallback(
    (payload: PendingPayload) => {
      const seq = activeRequestSeqRef.current + 1;
      activeRequestSeqRef.current = seq;
      activeRequestIdRef.current = payload.request.request_id ?? null;
      previewWindowUidsRef.current = payload.windowUids;
      setDialog({
        phase: "loading",
        segmentCount: payload.request.segments.length,
      });
      void postprocessRefineSegments(payload.request)
        .then((out) => {
          if (activeRequestSeqRef.current !== seq) return;
          activeRequestIdRef.current = null;
          const localErr = validateRefineOps(payload.request.segments, out.ops);
          if (localErr) {
            setDialog({ phase: "closed" });
            setError(localErr);
            return;
          }
          const applied = applySegmentRefineOps(segmentsRef.current, out.ops);
          if (!applied || !segmentsMonotonicByTime(applied)) {
            setDialog({ phase: "closed" });
            setError("段界建议无法安全应用到当前语段，请重试或手改。");
            return;
          }
          markLlmConnectionVerified();
          previewOpsRef.current = out.ops;
          setDialog({
            phase: "preview",
            ops: out.ops,
            opLabels: describeRefineOpsForPreview(payload.request.segments, out.ops),
            rationale: out.rationale ?? null,
            provider: out.provider,
            latencyMs: out.latencyMs ?? out.latency_ms ?? 0,
            beforeCount: segmentsRef.current.length,
            afterCount: applied.length,
          });
        })
        .catch((e) => {
          if (activeRequestSeqRef.current !== seq) return;
          activeRequestIdRef.current = null;
          setDialog({ phase: "closed" });
          setError(e instanceof Error ? e.message : String(e));
        });
    },
    [segmentsRef, setError],
  );

  const requestSegmentRefine = useCallback(() => {
    const payload = buildPayload();
    if (!payload) return;
    pendingPayloadRef.current = payload;
    if (window.localStorage.getItem(LLM_CONSENT_KEY) !== "accepted") {
      setDialog({
        phase: "consent",
        segmentCount: payload.request.segments.length,
        opSummary: null,
      });
      return;
    }
    startRequest(payload);
  }, [buildPayload, startRequest]);

  const confirmSegmentRefineConsent = useCallback(() => {
    const payload = pendingPayloadRef.current;
    if (!payload) return;
    window.localStorage.setItem(LLM_CONSENT_KEY, "accepted");
    startRequest(payload);
  }, [startRequest]);

  const confirmSegmentRefineWriteback = useCallback(() => {
    if (dialog.phase !== "preview") return;
    const ops = previewOpsRef.current;
    const applied = applySegmentRefineOps(segmentsRef.current, ops);
    if (!applied || !segmentsMonotonicByTime(applied)) {
      setDialog({ phase: "closed" });
      setError("语段已变化，无法写回段界整理结果，请重新尝试。");
      return;
    }
    const focusUid = previewWindowUidsRef.current.find(
      (uid) => findSegmentIndexByUid(segmentsRef.current, uid) >= 0,
    );
    pushUndo();
    publishSegmentTextBulkMutation(segmentsRef, setSegments, applied);
    const ni = focusUid ? findSegmentIndexByUid(applied, focusUid) : 0;
    setSelectedIdx(ni >= 0 ? ni : Math.min(selectedIdx, Math.max(0, applied.length - 1)));
    setDialog({ phase: "closed" });
  }, [dialog.phase, pushUndo, segmentsRef, selectedIdx, setError, setSegments, setSelectedIdx]);

  const cancelSegmentRefine = useCallback(() => {
    activeRequestSeqRef.current += 1;
    const requestId = activeRequestIdRef.current;
    activeRequestIdRef.current = null;
    pendingPayloadRef.current = null;
    previewOpsRef.current = [];
    setDialog({ phase: "closed" });
    if (requestId) {
      void postprocessCancelAutoPunctuate(requestId).catch(() => {
        /* ignore */
      });
    }
  }, []);

  return {
    canRefineSegments,
    segmentRefineBlockReason,
    segmentRefineDialog: dialog,
    requestSegmentRefine,
    confirmSegmentRefineConsent,
    confirmSegmentRefineWriteback,
    cancelSegmentRefine,
  };
}
