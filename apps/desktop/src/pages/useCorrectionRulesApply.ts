import { useCallback } from "react";
import type { CorrectionRulesDialogState } from "./correctionRulesPanelTypes";
import { findSegmentIndexByUid } from "./segmentListHelpers";
import type { SegmentPublishApi } from "./segmentPublishApi";

type Args = {
  dialog: CorrectionRulesDialogState;
  segmentPublish: SegmentPublishApi;
  flushSegmentTextDrafts: () => void;
  pushUndo: () => void;
  setError: (msg: string) => void;
  saveSegments: (options?: { quiet?: boolean; countHits?: boolean }) => Promise<boolean>;
  closeStageA: () => void;
};

export function useCorrectionRulesApply(args: Args) {
  const {
    dialog,
    segmentPublish,
    flushSegmentTextDrafts,
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
    const next = [...segmentPublish.getCurrentSegmentsSnapshot()];
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
    segmentPublish.publishTextBulk(next);
    closeStageA();
    const saved = await saveSegments({ quiet: true, countHits: true });
    if (!saved) {
      setError("纠错规则已写回，但保存失败，请稍后手动保存。");
    }
  }, [closeStageA, dialog, flushSegmentTextDrafts, pushUndo, saveSegments, segmentPublish, setError]);

  return { confirmCorrectionRulesWriteback };
}
