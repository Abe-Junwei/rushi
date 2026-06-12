import { useCallback, useMemo, useState } from "react";
import { publishSegmentTextBulkMutation } from "./flushSegmentTextDrafts";
import { findSegmentIndexByUid } from "./segmentListHelpers";
import { correctionHighlightSpanToCharRange } from "../services/editor/correctionHighlightCharRange";
import {
  querySegmentListScrollRoot,
  scrollSegmentRowIntoViewContainer,
} from "../utils/segmentListVirtualWindow";
import type { SegmentDto } from "../tauri/projectApi";
import { correctionMemoryList, correctionStableRulesList } from "../tauri/correctionApi";
import {
  toRulePairs,
  type SegmentCorrectionChange,
} from "../services/editor/segmentCorrectionRulesApply";
import { buildLexiconHealthReport, type LexiconHealthReport } from "../services/editor/lexiconHealthReport";
import {
  applySegmentTextHygiene,
  segmentTextHygieneChanged,
} from "../services/editor/segmentTextHygiene";
import { buildStageAPreviewChanges } from "../services/editor/stageAPreviewPipeline";
import {
  filterReadOnlyCorrectionRuleHints,
  parseCorrectionRuleHintsFromWarnings,
  type CorrectionRuleHintPair,
} from "../services/editor/correctionRuleHints";
import {
  detectStableCorrectionRuleConflicts,
  formatStableRuleConflictMessage,
  type StableCorrectionRuleConflict,
} from "../services/editor/stableCorrectionRuleConflicts";
import {
  listLearningCorrectionHintsForSegments,
  type LearningCorrectionHint,
} from "../services/editor/learningCorrectionRuleHints";

export type CorrectionRulesDialogTrigger = "manual" | "postTranscribe";

export type CorrectionRulesDialogState =
  | { phase: "closed" }
  | { phase: "loading"; trigger?: CorrectionRulesDialogTrigger }
  | {
      phase: "preview";
      changes: SegmentCorrectionChange[];
      ruleCount: number;
      hygieneTouchedCount: number;
      lexiconHealth: LexiconHealthReport;
      selectedSegmentIdxs: number[];
      readOnlyTranscribeHints: CorrectionRuleHintPair[];
      readOnlyLearningHints: LearningCorrectionHint[];
      stableConflicts: StableCorrectionRuleConflict[];
      trigger?: CorrectionRulesDialogTrigger;
    }
  | {
      phase: "empty";
      readOnlyTranscribeHints: CorrectionRuleHintPair[];
      readOnlyLearningHints: LearningCorrectionHint[];
      lexiconHealth: LexiconHealthReport;
      trigger?: CorrectionRulesDialogTrigger;
    };

type Args = {
  busy: boolean;
  currentFileId: string | null;
  segments: SegmentDto[];
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  flushSegmentTextDrafts: () => void;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  pushUndo: () => void;
  setError: (msg: string) => void;
  saveSegments: (options?: { quiet?: boolean; countHits?: boolean }) => Promise<boolean>;
  transcribeWarnings?: string[];
};

export function useCorrectionRulesController(args: Args) {
  const {
    busy,
    currentFileId,
    segments,
    segmentsRef,
    flushSegmentTextDrafts,
    setSegments,
    pushUndo,
    setError,
    saveSegments,
    transcribeWarnings = [],
  } = args;

  const [dialog, setDialog] = useState<CorrectionRulesDialogState>({ phase: "closed" });
  const [previewFocusSegmentIdx, setPreviewFocusSegmentIdx] = useState<number | null>(null);

  const scrollToPreviewSegment = useCallback((segmentIdx: number) => {
    window.requestAnimationFrame(() => {
      const root = querySegmentListScrollRoot();
      if (!root) return;
      const next = scrollSegmentRowIntoViewContainer(segmentIdx, root, { align: "center" });
      if (next != null) root.scrollTop = next;
    });
  }, []);

  const blockReason = !currentFileId
    ? "请先打开一个文件"
    : busy
      ? "处理中，请稍候"
      : segments.length === 0
        ? "当前文件没有语段，无法规则纠错"
        : null;

  const canApplyCorrectionRules = blockReason === null;

  const closeStageA = useCallback(() => {
    setPreviewFocusSegmentIdx(null);
    setDialog({ phase: "closed" });
  }, []);

  const loadStableRulesPreview = useCallback(async () => {
    flushSegmentTextDrafts();
    const [rows, memoryEntries] = await Promise.all([
      correctionStableRulesList(),
      correctionMemoryList(),
    ]);
    const pairs = toRulePairs(rows);
    const changes = buildStageAPreviewChanges(segmentsRef.current, pairs);
    const stableConflicts = detectStableCorrectionRuleConflicts(rows);
    const lexiconHealth = buildLexiconHealthReport({
      memoryEntries,
      stableRules: rows,
      stableConflicts,
      segments: segmentsRef.current,
    });
    let hygieneTouchedCount = 0;
    for (const seg of segmentsRef.current) {
      const before = seg.text ?? "";
      if (segmentTextHygieneChanged(before, applySegmentTextHygiene(before))) {
        hygieneTouchedCount += 1;
      }
    }
    const hintPairs = filterReadOnlyCorrectionRuleHints(
      parseCorrectionRuleHintsFromWarnings(transcribeWarnings),
      pairs,
    );
    const readOnlyTranscribeHints = hintPairs;
    const transcribeKeys = new Set(
      hintPairs.map((h) => `${h.beforeText.trim()}\u0000${h.afterText.trim()}`),
    );
    const readOnlyLearningHints = listLearningCorrectionHintsForSegments(
      memoryEntries,
      pairs,
      segmentsRef.current,
    ).filter((h) => !transcribeKeys.has(`${h.beforeText}\u0000${h.afterText}`));
    return {
      changes,
      ruleCount: pairs.length,
      hygieneTouchedCount,
      lexiconHealth,
      readOnlyTranscribeHints,
      readOnlyLearningHints,
      stableConflicts,
    };
  }, [flushSegmentTextDrafts, segmentsRef, transcribeWarnings]);

  const openStageA = useCallback(
    async (trigger: CorrectionRulesDialogTrigger) => {
      if (!canApplyCorrectionRules) return;
      setDialog({ phase: "loading", trigger });
      setError("");
      try {
        const {
          changes,
          ruleCount,
          hygieneTouchedCount,
          lexiconHealth,
          readOnlyTranscribeHints,
          readOnlyLearningHints,
          stableConflicts,
        } = await loadStableRulesPreview();
        if (!changes.length) {
          setDialog({
            phase: "empty",
            readOnlyTranscribeHints,
            readOnlyLearningHints,
            lexiconHealth,
            trigger,
          });
          return;
        }
        const firstSegmentIdx = changes[0]?.segmentIdx ?? null;
        setPreviewFocusSegmentIdx(firstSegmentIdx);
        if (firstSegmentIdx != null) scrollToPreviewSegment(firstSegmentIdx);
        setDialog({
          phase: "preview",
          changes,
          ruleCount,
          hygieneTouchedCount,
          lexiconHealth,
          selectedSegmentIdxs: changes.map((c) => c.segmentIdx),
          readOnlyTranscribeHints,
          readOnlyLearningHints,
          stableConflicts,
          trigger,
        });
      } catch (e) {
        setDialog({ phase: "closed" });
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [canApplyCorrectionRules, loadStableRulesPreview, scrollToPreviewSegment, setError],
  );

  /** 转写后编排：打开阶段 A（完成后可接阶段 B）。 */
  const requestPostTranscribeProcessing = useCallback(async () => {
    if (!currentFileId || segmentsRef.current.length === 0) return;
    await openStageA("postTranscribe");
  }, [currentFileId, openStageA, segmentsRef]);

  /** 工具栏「规则纠错」。 */
  const openCorrectionRulesManual = useCallback(async () => {
    if (!currentFileId || segmentsRef.current.length === 0) return;
    await openStageA("manual");
  }, [currentFileId, openStageA, segmentsRef]);

  /** @deprecated 使用 `requestPostTranscribeProcessing` 或 `openCorrectionRulesManual` */
  const requestCorrectionRules = openCorrectionRulesManual;
  const openPostTranscribeStageA = requestPostTranscribeProcessing;
  const offerPostTranscribeStableRules = requestPostTranscribeProcessing;

  const focusCorrectionRulesPreviewSegment = useCallback(
    (segmentIdx: number) => {
      setPreviewFocusSegmentIdx(segmentIdx);
      scrollToPreviewSegment(segmentIdx);
    },
    [scrollToPreviewSegment],
  );

  const correctionRulesEditorHighlight = useMemo(() => {
    if (dialog.phase !== "preview" || previewFocusSegmentIdx == null) return null;
    const change = dialog.changes.find((ch) => ch.segmentIdx === previewFocusSegmentIdx);
    if (!change) return null;
    const range = correctionHighlightSpanToCharRange(change.beforeText, change.beforeHighlights[0]);
    if (!range) return null;
    return { segmentIdx: change.segmentIdx, ...range };
  }, [dialog, previewFocusSegmentIdx]);

  const toggleCorrectionRulesSegment = useCallback((segmentIdx: number) => {
    setDialog((prev) => {
      if (prev.phase !== "preview") return prev;
      const selected = new Set(prev.selectedSegmentIdxs);
      if (selected.has(segmentIdx)) selected.delete(segmentIdx);
      else selected.add(segmentIdx);
      return { ...prev, selectedSegmentIdxs: [...selected].sort((a, b) => a - b) };
    });
  }, []);

  const stableConflictMessage =
    dialog.phase === "preview" && dialog.stableConflicts.length > 0
      ? formatStableRuleConflictMessage(dialog.stableConflicts)
      : null;

  const confirmCorrectionRulesWriteback = useCallback(async () => {
    if (dialog.phase !== "preview") return;
    if (dialog.stableConflicts.length > 0) return;
    if (dialog.selectedSegmentIdxs.length === 0) return;
    flushSegmentTextDrafts();
    pushUndo();
    const selected = new Set(dialog.selectedSegmentIdxs);
    const next = [...segmentsRef.current];
    let applied = 0;
    for (const ch of dialog.changes) {
      if (!selected.has(ch.segmentIdx)) continue;
      const idx = ch.uid.trim() ? findSegmentIndexByUid(next, ch.uid) : ch.segmentIdx;
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
    publishSegmentTextBulkMutation(segmentsRef, setSegments, next);
    closeStageA();
    const saved = await saveSegments({ quiet: true, countHits: true });
    if (!saved) {
      setError("纠错规则已写回，但保存失败，请稍后手动保存。");
    }
  }, [closeStageA, dialog, flushSegmentTextDrafts, pushUndo, saveSegments, segmentsRef, setError, setSegments]);

  const cancelCorrectionRules = useCallback(() => {
    closeStageA();
  }, [closeStageA]);

  const closeCorrectionRulesEmpty = useCallback(() => {
    closeStageA();
  }, [closeStageA]);

  return {
    canApplyCorrectionRules,
    correctionRulesBlockReason: blockReason,
    correctionRulesDialog: dialog,
    correctionRulesStableConflictMessage: stableConflictMessage,
    openStageA,
    openCorrectionRulesManual,
    requestPostTranscribeProcessing,
    requestCorrectionRules,
    openPostTranscribeStageA,
    offerPostTranscribeStableRules,
    confirmCorrectionRulesWriteback,
    toggleCorrectionRulesSegment,
    focusCorrectionRulesPreviewSegment,
    correctionRulesEditorHighlight,
    cancelCorrectionRules,
    closeCorrectionRulesEmpty,
  };
}
