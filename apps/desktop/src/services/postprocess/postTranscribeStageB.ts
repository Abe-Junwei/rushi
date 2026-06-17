export {
  STAGE_B_REFINE_CLOUD_MAX_CHARS,
  STAGE_B_REFINE_CLOUD_MAX_SEGMENTS,
  STAGE_B_REFINE_LOCAL_MAX_CHARS,
  STAGE_B_REFINE_LOCAL_MAX_SEGMENTS,
  collectStageBEligibleSegmentIndices,
  countStageBProofreadBatches,
  estimateStageBProgressTotal,
  isLocalLoopbackRuntimeBridge,
  planStageBRefineChunks,
  resolveStageBRefineBatchLimits,
  type StageBRefineBatchLimits,
} from "./stageBRefineBatchPlanner";
export {
  describeStageBDropSummary,
  mapPostTranscribeStageBProofreadError,
  runPostTranscribeStageBPreview,
  type PostTranscribeStageBSegmentChange,
} from "./stageBPreviewRunner";

export function describeStageBProgress(args: {
  done: number;
  total: number;
}): { phaseLabel: string; detail: string; percent: number; stepDone: number; stepTotal: number } {
  const { done, total } = args;
  const stepTotal = Math.max(total, 1);
  /** `done` = 已完成批次数；进行中显示下一批序号，percent 不含未完成批 */
  const completed = Math.max(0, Math.min(done, stepTotal));
  const activeBatch = completed < stepTotal ? completed + 1 : stepTotal;
  const percent =
    stepTotal > 0
      ? completed >= stepTotal
        ? 100
        : Math.min(99, Math.round((completed / stepTotal) * 100))
      : 0;
  return {
    phaseLabel: "智能改稿",
    detail: `批次 ${activeBatch} / ${stepTotal}`,
    percent,
    stepDone: activeBatch,
    stepTotal,
  };
}

/** 智能改稿预览面板顶栏说明（PostTranscribeStageBDialog preview）。 */
export function describeStageBPreviewSummary(changeCount: number): {
  headline: string;
  hint: string;
} {
  const n = Math.max(0, Math.floor(changeCount));
  return {
    headline: `共 ${n} 条语段有改稿建议`,
    hint: "暖色高亮为拟修改内容；含「同音推测」条目时请自行核对后再写回；勾选后点「确认写回」。",
  };
}
