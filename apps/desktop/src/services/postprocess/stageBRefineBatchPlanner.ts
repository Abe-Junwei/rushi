import type { SegmentDto } from "../../tauri/projectApi";
import { OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY } from "./llmProviderCatalog";
import type { PostprocessRuntimeBridge } from "./postprocessRuntimeContract";
import {
  segmentDtoToRefineItem,
  type RefineSegmentItem,
} from "./postprocessSegmentOps";

/** 本机 loopback：每批最多语段数（兼顾 30s 超时与 JSON 稳定性）。 */
export const STAGE_B_REFINE_LOCAL_MAX_SEGMENTS = 8;
/** 云端 API：每批最多语段数。 */
export const STAGE_B_REFINE_CLOUD_MAX_SEGMENTS = 16;
/** 本机 loopback：每批累计正文字符上限。 */
export const STAGE_B_REFINE_LOCAL_MAX_CHARS = 3000;
/** 云端 API：每批累计正文字符上限。 */
export const STAGE_B_REFINE_CLOUD_MAX_CHARS = 5000;

export type StageBRefineBatchLimits = {
  maxSegments: number;
  maxChars: number;
};

export function isLocalLoopbackRuntimeBridge(runtime: PostprocessRuntimeBridge): boolean {
  if (runtime.apiKey === OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY) return true;
  const base = runtime.baseUrl.trim();
  return (
    runtime.allowInsecureHttp === true &&
    (base.startsWith("http://127.0.0.1") || base.startsWith("http://localhost"))
  );
}

export function resolveStageBRefineBatchLimits(runtime: PostprocessRuntimeBridge): StageBRefineBatchLimits {
  if (isLocalLoopbackRuntimeBridge(runtime)) {
    return {
      maxSegments: STAGE_B_REFINE_LOCAL_MAX_SEGMENTS,
      maxChars: STAGE_B_REFINE_LOCAL_MAX_CHARS,
    };
  }
  return {
    maxSegments: STAGE_B_REFINE_CLOUD_MAX_SEGMENTS,
    maxChars: STAGE_B_REFINE_CLOUD_MAX_CHARS,
  };
}

/** 收集有正文语段的下标；Stage B 处理全部 eligible。 */
export function collectStageBEligibleSegmentIndices(segments: SegmentDto[]): number[] {
  const eligibleIdxs: number[] = [];
  for (let i = 0; i < segments.length; i++) {
    const text = (segments[i]?.text ?? "").trim();
    if (text) eligibleIdxs.push(i);
  }
  return eligibleIdxs;
}

/** 按语段数 + 正文字数自适应切批；单段超长时仍单独成批。 */
export function planStageBRefineChunks(
  items: RefineSegmentItem[],
  limits: StageBRefineBatchLimits,
): RefineSegmentItem[][] {
  if (items.length === 0) return [];
  const chunks: RefineSegmentItem[][] = [];
  let current: RefineSegmentItem[] = [];
  let currentChars = 0;

  const flush = () => {
    if (!current.length) return;
    chunks.push(current);
    current = [];
    currentChars = 0;
  };

  for (const item of items) {
    const chars = item.text.trim().length;
    const wouldExceedCount = current.length >= limits.maxSegments;
    const wouldExceedChars = current.length > 0 && currentChars + chars > limits.maxChars;
    if (wouldExceedCount || wouldExceedChars) flush();
    current.push(item);
    currentChars += chars;
  }
  flush();
  return chunks;
}

function buildStageBRefineItems(segments: SegmentDto[], workIdxs: number[]): RefineSegmentItem[] {
  const items: RefineSegmentItem[] = [];
  for (const idx of workIdxs) {
    const item = segmentDtoToRefineItem(segments[idx]);
    if (item) items.push(item);
  }
  return items;
}

export function countStageBProofreadBatches(args: {
  segments: SegmentDto[];
  runtime: PostprocessRuntimeBridge;
}): number {
  const workIdxs = collectStageBEligibleSegmentIndices(args.segments);
  if (workIdxs.length === 0) return 0;
  const refineItems = buildStageBRefineItems(args.segments, workIdxs);
  return planStageBRefineChunks(refineItems, resolveStageBRefineBatchLimits(args.runtime)).length;
}

/** @deprecated 合并策略下等于批次数 */
export function estimateStageBProgressTotal(args: {
  segments: SegmentDto[];
  runtime: PostprocessRuntimeBridge;
}): number {
  return countStageBProofreadBatches(args);
}

export function buildStageBRefinePlan(args: {
  segments: SegmentDto[];
  runtime: PostprocessRuntimeBridge;
}): {
  workIdxs: number[];
  refineItems: RefineSegmentItem[];
  refineChunks: RefineSegmentItem[][];
  refineLimits: StageBRefineBatchLimits;
  progressTotal: number;
} {
  const workIdxs = collectStageBEligibleSegmentIndices(args.segments);
  const refineLimits = resolveStageBRefineBatchLimits(args.runtime);
  const refineItems = buildStageBRefineItems(args.segments, workIdxs);
  const refineChunks = planStageBRefineChunks(refineItems, refineLimits);
  return {
    workIdxs,
    refineItems,
    refineChunks,
    refineLimits,
    progressTotal: refineChunks.length,
  };
}
