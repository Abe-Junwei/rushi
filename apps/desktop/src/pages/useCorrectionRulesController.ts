import { useCallback, useState } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { correctionStableRulesList } from "../tauri/correctionApi";
import {
  buildSegmentCorrectionChanges,
  toRulePairs,
  type SegmentCorrectionChange,
} from "../services/editor/segmentCorrectionRulesApply";

export type CorrectionRulesDialogState =
  | { phase: "closed" }
  | { phase: "loading" }
  | { phase: "preview"; changes: SegmentCorrectionChange[]; ruleCount: number }
  | { phase: "empty" };

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
  } = args;

  const [dialog, setDialog] = useState<CorrectionRulesDialogState>({ phase: "closed" });

  const blockReason = !currentFileId
    ? "请先打开一个文件"
    : busy
      ? "处理中，请稍候"
      : segments.length === 0
        ? "当前文件没有语段"
        : null;

  const canApplyCorrectionRules = blockReason === null;

  const requestCorrectionRules = useCallback(async () => {
    if (!canApplyCorrectionRules) return;
    flushSegmentTextDrafts();
    setDialog({ phase: "loading" });
    setError("");
    try {
      const rows = await correctionStableRulesList();
      const pairs = toRulePairs(rows);
      const changes = buildSegmentCorrectionChanges(segmentsRef.current, pairs);
      if (!changes.length) {
        setDialog({ phase: "empty" });
        return;
      }
      setDialog({ phase: "preview", changes, ruleCount: pairs.length });
    } catch (e) {
      setDialog({ phase: "closed" });
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [canApplyCorrectionRules, flushSegmentTextDrafts, segmentsRef, setError]);

  const confirmCorrectionRulesWriteback = useCallback(async () => {
    if (dialog.phase !== "preview") return;
    flushSegmentTextDrafts();
    pushUndo();
    const next = [...segmentsRef.current];
    for (const ch of dialog.changes) {
      const row = next[ch.segmentIdx];
      if (row) next[ch.segmentIdx] = { ...row, text: ch.afterText };
    }
    segmentsRef.current = next;
    setSegments(next);
    setDialog({ phase: "closed" });
    const saved = await saveSegments({ quiet: true, countHits: true });
    if (!saved) {
      setError("纠错规则已写回，但保存失败，请稍后手动保存。");
    }
  }, [dialog, flushSegmentTextDrafts, pushUndo, saveSegments, segmentsRef, setError, setSegments]);

  const cancelCorrectionRules = useCallback(() => {
    setDialog({ phase: "closed" });
  }, []);

  return {
    canApplyCorrectionRules,
    correctionRulesBlockReason: blockReason,
    correctionRulesDialog: dialog,
    requestCorrectionRules,
    confirmCorrectionRulesWriteback,
    cancelCorrectionRules,
  };
}
