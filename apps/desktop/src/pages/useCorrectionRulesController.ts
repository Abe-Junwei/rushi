import { useCallback, useMemo, useState } from "react";
import { scheduleScrollSegmentListIndexToView } from "../utils/segmentListVirtualWindow";
import type { SegmentDto } from "../tauri/projectApi";
import { correctionHighlightSpanToCharRange } from "../services/editor/correctionHighlightCharRange";
import { formatStableRuleConflictMessage } from "../services/editor/stableCorrectionRuleConflicts";
import { loadCorrectionRulesPreview } from "./correctionRulesPreviewLoader";
import {
  type CorrectionRulesDialogState,
  type CorrectionRulesDialogTrigger,
} from "./correctionRulesPanelTypes";
import { useCorrectionRulesApply } from "./useCorrectionRulesApply";
import { readTranscriptEditorCoreEnabled } from "../components/editor/core/transcriptEditorCoreFlag";
import { dispatchTranscriptFocusFindMatch } from "../components/editor/core/transcriptEditorViewHandle";

export type { CorrectionRulesDialogTrigger, CorrectionRulesDialogState } from "./correctionRulesPanelTypes";

import type { SegmentPublishApi } from "./segmentPublishApi";

type Args = {
  busy: boolean;
  currentFileId: string | null;
  segments: SegmentDto[];
  segmentPublish: SegmentPublishApi;
  flushSegmentTextDrafts: () => void;
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
    segmentPublish,
    flushSegmentTextDrafts,
    pushUndo,
    setError,
    saveSegments,
    transcribeWarnings = [],
  } = args;

  const [dialog, setDialog] = useState<CorrectionRulesDialogState>({ phase: "closed" });
  const [previewFocusSegmentIdx, setPreviewFocusSegmentIdx] = useState<number | null>(null);

  const scrollToPreviewSegment = useCallback((segmentIdx: number) => {
    if (
      readTranscriptEditorCoreEnabled() &&
      dispatchTranscriptFocusFindMatch(segmentIdx)
    ) {
      return;
    }
    scheduleScrollSegmentListIndexToView(segmentIdx);
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

  const openStageA = useCallback(
    async (trigger: CorrectionRulesDialogTrigger) => {
      if (!canApplyCorrectionRules) return;
      setDialog({ phase: "loading", trigger });
      setError("");
      try {
        flushSegmentTextDrafts();
        const {
          changes,
          ruleCount,
          hygieneTouchedCount,
          lexiconHealth,
          readOnlyTranscribeHints,
          readOnlyLearningHints,
          stableConflicts,
        } = await loadCorrectionRulesPreview({
          segments: segmentPublish.getCurrentSegmentsSnapshot(),
          transcribeWarnings,
        });
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
    [
      canApplyCorrectionRules,
      flushSegmentTextDrafts,
      segmentPublish,
      scrollToPreviewSegment,
      setError,
      transcribeWarnings,
    ],
  );

  /** 转写后编排：打开阶段 A（完成后可接阶段 B）。 */
  const requestPostTranscribeProcessing = useCallback(async () => {
    if (!currentFileId || segmentPublish.getCurrentSegmentsSnapshot().length === 0) return;
    await openStageA("postTranscribe");
  }, [currentFileId, openStageA, segmentPublish]);

  /** 工具栏「规则纠错」。 */
  const openCorrectionRulesManual = useCallback(async () => {
    if (!currentFileId || segmentPublish.getCurrentSegmentsSnapshot().length === 0) return;
    await openStageA("manual");
  }, [currentFileId, openStageA, segmentPublish]);

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

  const { confirmCorrectionRulesWriteback } = useCorrectionRulesApply({
    dialog,
    segmentPublish,
    flushSegmentTextDrafts,
    pushUndo,
    setError,
    saveSegments,
    closeStageA,
  });

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
