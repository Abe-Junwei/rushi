import { useCallback } from "react";
import { publishSegmentTextBulkMutation } from "./flushSegmentTextDrafts";
import { findSegmentIndexByUid } from "./segmentListHelpers";
import type { SegmentDto } from "../tauri/projectApi";
import type { CorrectionRulesDialogState } from "./correctionRulesPanelTypes";

type Args = {
  dialog: CorrectionRulesDialogState;
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  flushSegmentTextDrafts: () => void;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  pushUndo: () => void;
  setError: (msg: string) => void;
  saveSegments: (options?: { quiet?: boolean; countHits?: boolean }) => Promise<boolean>;
  closeStageA: () => void;
};

export function useCorrectionRulesApply(args: Args) {
  const {
    dialog,
    segmentsRef,
    flushSegmentTextDrafts,
    setSegments,
    pushUndo,
    setError,
    saveSegments,
    closeStageA,
  } = args;

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

  return { confirmCorrectionRulesWriteback };
}
