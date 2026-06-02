import { useCallback, useMemo, useRef, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  correctionAcceptRule,
  postprocessCancelAutoPunctuate,
  postprocessLexiconProofread,
  type GroundedLexiconOp,
  type PostprocessLexiconProofreadRequest,
  type SegmentRefineOp,
} from "../tauri/postprocessApi";
import { collectRefineSegmentWindow } from "../services/postprocess/postprocessSegmentOps";
import {
  describeLexiconOpsForPreview,
  rulePairsFromLexiconItems,
} from "../services/postprocess/postprocessLexiconOps";
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
import { validateRefineOps } from "../services/postprocess/postprocessSegmentOps";

const LEXICON_CONSENT_KEY = "rushi:lexicon-proofread-consent:v1";

export type LexiconProofreadDialogState =
  | { phase: "closed" }
  | { phase: "consent"; segmentCount: number; packHint: string | null }
  | { phase: "loading"; segmentCount: number }
  | {
      phase: "preview";
      ops: SegmentRefineOp[];
      items: GroundedLexiconOp[];
      opLabels: string[];
      rationale: string | null;
      warnings: string[];
      packTruncated: boolean;
      provider: string;
      latencyMs: number;
      acceptRulesOnWriteback: boolean;
      /** 与 items/opLabels 下标对齐；默认全选 */
      selectedOpIndexes: boolean[];
    };

type UseLexiconProofreadControllerArgs = {
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
};

export type LexiconProofreadControllerApi = {
  canLexiconProofread: boolean;
  lexiconProofreadBlockReason: string | null;
  lexiconProofreadDialog: LexiconProofreadDialogState;
  requestLexiconProofread: () => void;
  confirmLexiconProofreadConsent: () => void;
  confirmLexiconProofreadWriteback: () => void;
  setLexiconAcceptRulesOnWriteback: (value: boolean) => void;
  toggleLexiconProofreadOp: (index: number, selected: boolean) => void;
  setAllLexiconProofreadOps: (selected: boolean) => void;
  cancelLexiconProofread: () => void;
};

type PendingPayload = {
  request: PostprocessLexiconProofreadRequest;
  windowUids: string[];
};

function createLexiconRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `lexicon-proofread-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useLexiconProofreadController(
  args: UseLexiconProofreadControllerArgs,
): LexiconProofreadControllerApi {
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
  } = args;

  const [dialog, setDialog] = useState<LexiconProofreadDialogState>({ phase: "closed" });
  const activeRequestSeqRef = useRef(0);
  const activeRequestIdRef = useRef<string | null>(null);
  const pendingPayloadRef = useRef<PendingPayload | null>(null);
  const previewWindowUidsRef = useRef<string[]>([]);
  const previewOpsRef = useRef<SegmentRefineOp[]>([]);
  const previewItemsRef = useRef<GroundedLexiconOp[]>([]);
  const acceptRulesRef = useRef(false);

  const selected = segments[selectedIdx] ?? null;
  const lexiconProofreadBlockReason = useMemo(() => {
    if (transcribePreviewActive) return TRANSCRIBE_PREVIEW_BLOCK_REASON;
    const base = resolveAutoPunctuateBlockReason({
      currentFileId,
      hasSegmentText: !!(selected?.text ?? "").trim(),
      keychainReady: llmKeychainReady,
      keychainChecking: llmKeychainChecking,
    });
    if (base) return base;
    if (!selected?.uid?.trim()) return "当前语段缺少 uid，无法执行词表校对。";
    const window = collectRefineSegmentWindow(segments, selectedIdx);
    if (window.length === 0) return "请先选中一条有正文的语段。";
    return null;
  }, [
    transcribePreviewActive,
    currentFileId,
    llmKeychainChecking,
    llmKeychainReady,
    llmRuntimeEpoch,
    selected,
    segments,
    selectedIdx,
  ]);

  const canLexiconProofread =
    !busy &&
    !transcribePreviewActive &&
    !!currentFileId &&
    isLlmRuntimeReady() &&
    lexiconProofreadBlockReason === null;

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
        task: "lexicon_proofread",
        request_id: createLexiconRequestId(),
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
      void postprocessLexiconProofread(payload.request)
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
            setError("词表校对建议无法安全应用到当前语段，请重试或手改。");
            return;
          }
          markLlmConnectionVerified();
          const items = out.items ?? [];
          previewOpsRef.current = out.ops;
          previewItemsRef.current = items;
          acceptRulesRef.current = false;
          setDialog({
            phase: "preview",
            ops: out.ops,
            items,
            opLabels: describeLexiconOpsForPreview(payload.request.segments, items),
            rationale: out.rationale ?? null,
            warnings: out.warnings ?? [],
            packTruncated: out.packMeta?.truncated === true,
            provider: out.provider,
            latencyMs: out.latencyMs ?? out.latency_ms ?? 0,
            acceptRulesOnWriteback: false,
            selectedOpIndexes: items.map(() => true),
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

  const requestLexiconProofread = useCallback(() => {
    const payload = buildPayload();
    if (!payload) return;
    pendingPayloadRef.current = payload;
    if (window.localStorage.getItem(LEXICON_CONSENT_KEY) !== "accepted") {
      setDialog({
        phase: "consent",
        segmentCount: payload.request.segments.length,
        packHint: null,
      });
      return;
    }
    startRequest(payload);
  }, [buildPayload, startRequest]);

  const confirmLexiconProofreadConsent = useCallback(() => {
    const payload = pendingPayloadRef.current;
    if (!payload) return;
    window.localStorage.setItem(LEXICON_CONSENT_KEY, "accepted");
    startRequest(payload);
  }, [startRequest]);

  const setLexiconAcceptRulesOnWriteback = useCallback((value: boolean) => {
    acceptRulesRef.current = value;
    setDialog((prev) =>
      prev.phase === "preview" ? { ...prev, acceptRulesOnWriteback: value } : prev,
    );
  }, []);

  const toggleLexiconProofreadOp = useCallback((index: number, selected: boolean) => {
    setDialog((prev) => {
      if (prev.phase !== "preview" || index < 0 || index >= prev.selectedOpIndexes.length) {
        return prev;
      }
      const selectedOpIndexes = [...prev.selectedOpIndexes];
      selectedOpIndexes[index] = selected;
      return { ...prev, selectedOpIndexes };
    });
  }, []);

  const setAllLexiconProofreadOps = useCallback((selected: boolean) => {
    setDialog((prev) => {
      if (prev.phase !== "preview") return prev;
      return {
        ...prev,
        selectedOpIndexes: prev.selectedOpIndexes.map(() => selected),
      };
    });
  }, []);

  const confirmLexiconProofreadWriteback = useCallback(() => {
    if (dialog.phase !== "preview") return;
    const selectedFlags = dialog.selectedOpIndexes;
    const ops = previewOpsRef.current.filter((_, i) => selectedFlags[i]);
    if (ops.length === 0) {
      setError("请至少勾选一条建议再写回。");
      return;
    }
    const applied = applySegmentRefineOps(segmentsRef.current, ops);
    if (!applied || !segmentsMonotonicByTime(applied)) {
      setDialog({ phase: "closed" });
      setError("语段已变化，无法写回词表校对结果，请重新尝试。");
      return;
    }
    const focusUid = previewWindowUidsRef.current.find(
      (uid) => findSegmentIndexByUid(segmentsRef.current, uid) >= 0,
    );
    pushUndo();
    segmentsRef.current = applied;
    setSegments(applied);
    const ni = focusUid ? findSegmentIndexByUid(applied, focusUid) : 0;
    setSelectedIdx(ni >= 0 ? ni : Math.min(selectedIdx, Math.max(0, applied.length - 1)));

    if (acceptRulesRef.current) {
      const selectedItems = previewItemsRef.current.filter((_, i) => selectedFlags[i]);
      const pairs = rulePairsFromLexiconItems(selectedItems);
      for (const pair of pairs) {
        void correctionAcceptRule(pair.before, pair.after).catch(() => {
          /* non-blocking */
        });
      }
    }

    setDialog({ phase: "closed" });
  }, [dialog, pushUndo, segmentsRef, selectedIdx, setError, setSegments, setSelectedIdx]);

  const cancelLexiconProofread = useCallback(() => {
    activeRequestSeqRef.current += 1;
    const requestId = activeRequestIdRef.current;
    activeRequestIdRef.current = null;
    pendingPayloadRef.current = null;
    previewOpsRef.current = [];
    previewItemsRef.current = [];
    acceptRulesRef.current = false;
    setDialog({ phase: "closed" });
    if (requestId) {
      void postprocessCancelAutoPunctuate(requestId).catch(() => {
        /* ignore */
      });
    }
  }, []);

  return {
    canLexiconProofread,
    lexiconProofreadBlockReason,
    lexiconProofreadDialog: dialog,
    requestLexiconProofread,
    confirmLexiconProofreadConsent,
    confirmLexiconProofreadWriteback,
    setLexiconAcceptRulesOnWriteback,
    toggleLexiconProofreadOp,
    setAllLexiconProofreadOps,
    cancelLexiconProofread,
  };
}
