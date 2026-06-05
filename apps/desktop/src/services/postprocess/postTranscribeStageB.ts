import type { SegmentDto } from "../../tauri/projectApi";
import {
  postprocessAutoPunctuate,
  postprocessRefineSegments,
  type PostprocessAutoPunctuateRequest,
  type SegmentRefineOp,
} from "../../tauri/postprocessApi";
import { OLLAMA_LOOPBACK_PLACEHOLDER_API_KEY } from "./llmProviderCatalog";
import type { PostprocessRuntimeBridge } from "./postprocessRuntimeContract";
import { collectAutoPunctuateNeighborContext } from "../../pages/autoPunctuateNeighbors";
import { computeSingleTextDiff, type TextDiffSpan } from "../../utils/textDiff";
import {
  segmentDtoToRefineItem,
  validateRefineOps,
  type RefineSegmentItem,
} from "./postprocessSegmentOps";
import { formatSegmentTimeLabel } from "../editor/segmentFindReplace";

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

/** 收集有正文语段的下标；Stage B 处理全部 eligible，不再按 provider 截断。 */
export function collectStageBEligibleSegmentIndices(segments: SegmentDto[]): number[] {
  const eligibleIdxs: number[] = [];
  for (let i = 0; i < segments.length; i++) {
    const text = (segments[i]?.text ?? "").trim();
    if (text) eligibleIdxs.push(i);
  }
  return eligibleIdxs;
}

export type PostTranscribeStageBSegmentChange = {
  segmentIdx: number;
  segmentNumber: number;
  timeLabel: string;
  uid: string;
  beforeText: string;
  afterText: string;
  diff: TextDiffSpan[];
  punctuateTouched: boolean;
  typoTouched: boolean;
};

function createRequestId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function filterTypoOnlyRefineOps(ops: SegmentRefineOp[]): {
  typoOps: Array<Extract<SegmentRefineOp, { op: "update_text" }>>;
  rejectedBoundaryOps: number;
} {
  let rejectedBoundaryOps = 0;
  const typoOps: Array<Extract<SegmentRefineOp, { op: "update_text" }>> = [];
  for (const op of ops) {
    if (op.op === "update_text") typoOps.push(op);
    else rejectedBoundaryOps += 1;
  }
  return { typoOps, rejectedBoundaryOps };
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

/** 标点步数（= 有正文语段数），用于进度文案分段。 */
export function countStageBPunctuateSteps(segments: SegmentDto[]): number {
  return collectStageBEligibleSegmentIndices(segments).length;
}

export function describeStageBProgress(args: {
  done: number;
  total: number;
  punctuateSteps: number;
}): { phaseLabel: string; detail: string; percent: number } {
  const { done, total, punctuateSteps } = args;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  if (punctuateSteps <= 0 || done < punctuateSteps) {
    const step = Math.min(done + 1, Math.max(punctuateSteps, 1));
    return {
      phaseLabel: "标点",
      detail: `语段 ${step} / ${Math.max(punctuateSteps, 1)}`,
      percent,
    };
  }
  const refineTotal = Math.max(total - punctuateSteps, 1);
  const refineDone = Math.min(done - punctuateSteps + 1, refineTotal);
  return {
    phaseLabel: "错字",
    detail: `批次 ${refineDone} / ${refineTotal}`,
    percent,
  };
}

/** 加载进度：标点语段数 + 错字批次数（按 provider 与正文字数估算）。 */
export function estimateStageBProgressTotal(args: {
  segments: SegmentDto[];
  runtime: PostprocessRuntimeBridge;
}): number {
  const workIdxs = collectStageBEligibleSegmentIndices(args.segments);
  if (workIdxs.length === 0) return 0;
  const refineItems = buildStageBRefineItems(args.segments, workIdxs);
  const refineBatches = planStageBRefineChunks(
    refineItems,
    resolveStageBRefineBatchLimits(args.runtime),
  ).length;
  return workIdxs.length + refineBatches;
}

/** 将 Rust 段界整理文案映射为智能改稿语境。 */
export function mapPostTranscribeStageBRefineError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw.split("段界整理").join("智能改稿（错字）");
}

export async function runPostTranscribeStageBPreview(args: {
  segments: SegmentDto[];
  runtime: PostprocessRuntimeBridge;
  onProgress?: (done: number, total: number) => void;
}): Promise<{
  changes: PostTranscribeStageBSegmentChange[];
  provider: string;
  rejectedBoundaryOps: number;
  typoStepError: string | null;
}> {
  const workIdxs = collectStageBEligibleSegmentIndices(args.segments);
  const working = args.segments.map((s) => ({ ...s }));
  const punctuateTouched = new Set<number>();
  const typoTouched = new Set<number>();
  let provider = "";
  let rejectedBoundaryOps = 0;
  let typoStepError: string | null = null;

  const refineLimits = resolveStageBRefineBatchLimits(args.runtime);
  const progressTotal = estimateStageBProgressTotal({
    segments: args.segments,
    runtime: args.runtime,
  });

  for (let n = 0; n < workIdxs.length; n++) {
    const idx = workIdxs[n]!;
    const row = working[idx];
    if (!row?.uid?.trim() || !row.text.trim()) continue;
    args.onProgress?.(n, progressTotal);
    const neighbor_context = collectAutoPunctuateNeighborContext(working, idx);
    const req: PostprocessAutoPunctuateRequest = {
      task: "auto_punctuate",
      request_id: createRequestId("f0-stage-b-punct"),
      segment_uid: row.uid,
      text: row.text,
      neighbor_context,
      runtime: args.runtime,
    };
    const out = await postprocessAutoPunctuate(req);
    provider = out.provider || provider;
    if (out.text.trim() && out.text !== row.text) {
      working[idx] = { ...row, text: out.text };
      punctuateTouched.add(idx);
    }
  }

  const refineItems = buildStageBRefineItems(working, workIdxs);
  const refineIdxByUid = new Map<string, number>();
  for (const idx of workIdxs) {
    const row = working[idx];
    const item = row ? segmentDtoToRefineItem(row) : null;
    if (item) refineIdxByUid.set(item.uid, idx);
  }

  const refineChunks = planStageBRefineChunks(refineItems, refineLimits);
  for (let batch = 0; batch < refineChunks.length; batch++) {
    const chunk = refineChunks[batch];
    if (!chunk?.length) continue;
    args.onProgress?.(workIdxs.length + batch, progressTotal);
    try {
      const refineOut = await postprocessRefineSegments({
        task: "refine_segments",
        request_id: createRequestId("f0-stage-b-typo"),
        segments: chunk,
        runtime: args.runtime,
      });
      provider = refineOut.provider || provider;
      const { typoOps, rejectedBoundaryOps: rejected } = filterTypoOnlyRefineOps(refineOut.ops);
      rejectedBoundaryOps += rejected;
      const err = validateRefineOps(chunk, typoOps);
      if (err) {
        typoStepError = err;
        continue;
      }
      for (const op of typoOps) {
        const idx = refineIdxByUid.get(op.uid.trim());
        if (idx === undefined) continue;
        const row = working[idx];
        if (!row) continue;
        if (op.text.trim() && op.text !== row.text) {
          working[idx] = { ...row, text: op.text };
          typoTouched.add(idx);
        }
      }
    } catch (e) {
      typoStepError = mapPostTranscribeStageBRefineError(e);
      break;
    }
  }

  const changes: PostTranscribeStageBSegmentChange[] = [];
  for (const idx of workIdxs) {
    const before = args.segments[idx];
    const after = working[idx];
    if (!before || !after) continue;
    const beforeText = before.text ?? "";
    const afterText = after.text ?? "";
    if (beforeText === afterText) continue;
    changes.push({
      segmentIdx: idx,
      segmentNumber: idx + 1,
      timeLabel: formatSegmentTimeLabel(before),
      uid: after.uid ?? "",
      beforeText,
      afterText,
      diff: computeSingleTextDiff(beforeText, afterText),
      punctuateTouched: punctuateTouched.has(idx),
      typoTouched: typoTouched.has(idx),
    });
  }

  args.onProgress?.(progressTotal, progressTotal);
  return {
    changes,
    provider,
    rejectedBoundaryOps,
    typoStepError,
  };
}
