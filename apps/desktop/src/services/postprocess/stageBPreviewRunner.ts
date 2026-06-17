import type { SegmentDto } from "../../tauri/projectApi";
import {
  postprocessStageBProofread,
  type GroundedLexiconOp,
  type PostprocessStageBProofreadRequest,
} from "../../tauri/postprocessApi";
import type { PostprocessRuntimeBridge } from "./postprocessRuntimeContract";
import { computeSingleTextDiff, type TextDiffSpan } from "../../utils/textDiff";
import { segmentDtoToRefineItem } from "./postprocessSegmentOps";
import { formatSegmentTimeLabel } from "../editor/segmentFindReplace";
import { classifyStageBSegmentChangeFlags } from "./postprocessLexiconOps";
import { buildStageBRefinePlan } from "./stageBRefineBatchPlanner";

/** 智能改稿「已忽略 N 条」说明：区分格式、无依据、依据不符与 LLM 空返。 */
export function describeStageBDropSummary(stats: {
  parseMalformed: number;
  unchanged: number;
  invalid: number;
  ungrounded: number;
  evidenceMismatch: number;
  llmHomophone: number;
}): { ignoredCount: number; detail: string | null } {
  const ignoredCount =
    stats.parseMalformed + stats.invalid + stats.ungrounded + stats.evidenceMismatch;
  const parts: string[] = [];
  if (stats.llmHomophone > 0) {
    parts.push(`${stats.llmHomophone} 条同音推测已列入候选（无词表依据，请自行核对）`);
  }
  if (stats.parseMalformed > 0) {
    parts.push(`JSON 结构不完整 ${stats.parseMalformed} 条`);
  }
  if (stats.invalid > 0) {
    parts.push(`字段无效 ${stats.invalid} 条`);
  }
  if (stats.ungrounded > 0) {
    parts.push(`改动过大或无法识别 ${stats.ungrounded} 条`);
  }
  if (stats.evidenceMismatch > 0) {
    parts.push(`依据与改动不符 ${stats.evidenceMismatch} 条`);
  }
  const tail =
    stats.unchanged > 0 ? `另有 ${stats.unchanged} 条 LLM 返回但未改动正文。` : "";
  const detail =
    parts.length > 0
      ? `${parts.join("；")}。${tail}${ignoredCount > 0 ? "其余已忽略。" : ""}`
      : stats.unchanged > 0
        ? `${stats.unchanged} 条 LLM 返回但未改动正文，未计入忽略。`
        : null;
  return { ignoredCount, detail };
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
  evidenceSummary: string | null;
};

function createRequestId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function mapPostTranscribeStageBProofreadError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("智能改稿")) return raw;
  return raw
    .split("段界整理")
    .join("智能改稿")
    .split("词表校对")
    .join("智能改稿")
    .split("自动标点")
    .join("智能改稿");
}

function formatStageBPackTruncationHint(
  packMeta: { truncated?: boolean; glossaryCount?: number; rulesCount?: number } | undefined,
): string | null {
  if (!packMeta?.truncated) return null;
  const parts = ["词表或纠错规则条目过多，本次请求仅携带部分 Pack 上下文"];
  if (packMeta.glossaryCount != null || packMeta.rulesCount != null) {
    parts.push(
      `（已载入术语 ${packMeta.glossaryCount ?? "?"} 条、规则 ${packMeta.rulesCount ?? "?"} 条）`,
    );
  }
  return `${parts.join("")}。若改字候选偏少，可先完成「规则纠错」或精简热词与记忆。`;
}

export async function runPostTranscribeStageBPreview(args: {
  segments: SegmentDto[];
  runtime: PostprocessRuntimeBridge;
  onProgress?: (done: number, total: number) => void;
  /** 返回 false 时停止后续批次（用户取消） */
  shouldContinue?: () => boolean;
  /** 当前批次 request_id，供后端 abort 注册 */
  onActiveRequestId?: (requestId: string) => void;
}): Promise<{
  changes: PostTranscribeStageBSegmentChange[];
  provider: string;
  rejectedBoundaryOps: number;
  typoStepError: string | null;
  droppedUngroundedOps: number;
  dropStats: {
    parseMalformed: number;
    unchanged: number;
    invalid: number;
    ungrounded: number;
    evidenceMismatch: number;
    llmHomophone: number;
  };
  dropDetail: string | null;
  packTruncationHint: string | null;
}> {
  const { workIdxs, refineChunks, progressTotal } = buildStageBRefinePlan(args);
  const working = args.segments.map((s) => ({ ...s }));
  const evidenceByIdx = new Map<number, GroundedLexiconOp[]>();
  let provider = "";
  let typoStepError: string | null = null;
  const dropStats = {
    parseMalformed: 0,
    unchanged: 0,
    invalid: 0,
    ungrounded: 0,
    evidenceMismatch: 0,
    llmHomophone: 0,
  };
  let packTruncationHint: string | null = null;

  const refineIdxByUid = new Map<string, number>();
  for (const idx of workIdxs) {
    const row = working[idx];
    const item = row ? segmentDtoToRefineItem(row) : null;
    if (item) refineIdxByUid.set(item.uid, idx);
  }

  args.onProgress?.(0, progressTotal);

  for (let batch = 0; batch < refineChunks.length; batch++) {
    if (args.shouldContinue && !args.shouldContinue()) break;
    const chunk = refineChunks[batch];
    if (!chunk?.length) continue;
    try {
      const requestId = createRequestId("f0-stage-b-merged");
      args.onActiveRequestId?.(requestId);
      const req: PostprocessStageBProofreadRequest = {
        task: "stage_b_proofread",
        request_id: requestId,
        segments: chunk,
        runtime: args.runtime,
      };
      const refineOut = await postprocessStageBProofread(req);
      if (args.shouldContinue && !args.shouldContinue()) break;
      provider = refineOut.provider || provider;
      if (refineOut.dropStats) {
        dropStats.parseMalformed += refineOut.dropStats.parseMalformed ?? 0;
        dropStats.unchanged += refineOut.dropStats.unchanged ?? 0;
        dropStats.invalid += refineOut.dropStats.invalid ?? 0;
        dropStats.ungrounded += refineOut.dropStats.ungrounded ?? 0;
        dropStats.evidenceMismatch += refineOut.dropStats.evidenceMismatch ?? 0;
        dropStats.llmHomophone += refineOut.dropStats.llmHomophone ?? 0;
      }
      const batchPackHint = formatStageBPackTruncationHint(refineOut.packMeta);
      if (batchPackHint) packTruncationHint = batchPackHint;

      for (const item of refineOut.items) {
        const idx = refineIdxByUid.get(item.uid.trim());
        if (idx === undefined) continue;
        const row = working[idx];
        if (!row) continue;
        if (item.text.trim() && item.text !== row.text) {
          working[idx] = { ...row, text: item.text };
          const prev = evidenceByIdx.get(idx) ?? [];
          prev.push(item);
          evidenceByIdx.set(idx, prev);
        }
      }
      args.onProgress?.(batch + 1, progressTotal);
    } catch (e) {
      if (args.shouldContinue && !args.shouldContinue()) break;
      typoStepError = mapPostTranscribeStageBProofreadError(e);
      if (evidenceByIdx.size === 0) break;
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
    const evidenceItems = evidenceByIdx.get(idx) ?? [];
    const flags = classifyStageBSegmentChangeFlags(beforeText, afterText, evidenceItems);
    changes.push({
      segmentIdx: idx,
      segmentNumber: idx + 1,
      timeLabel: formatSegmentTimeLabel(before),
      uid: after.uid ?? "",
      beforeText,
      afterText,
      diff: computeSingleTextDiff(beforeText, afterText),
      punctuateTouched: flags.punctuateTouched,
      typoTouched: flags.typoTouched,
      evidenceSummary: flags.evidenceSummary,
    });
  }

  const { ignoredCount, detail: dropDetail } = describeStageBDropSummary(dropStats);

  return {
    changes,
    provider,
    rejectedBoundaryOps: 0,
    typoStepError,
    droppedUngroundedOps: ignoredCount,
    dropStats,
    dropDetail,
    packTruncationHint,
  };
}
