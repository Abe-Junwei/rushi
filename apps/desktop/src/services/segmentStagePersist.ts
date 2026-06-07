import type { SegmentDto } from "../tauri/projectApi";
import {
  DEFAULT_SEGMENT_TEXT_STAGE,
  leastConfirmedSegmentStage,
  normalizeSegmentTextStage,
  type SegmentFinalizeVia,
  type SegmentTextStage,
} from "./segmentTextStage";

function clearedFinalize(): null {
  return null;
}

export function withFinalizedStage(
  seg: SegmentDto,
  via: SegmentFinalizeVia,
): SegmentDto {
  return {
    ...seg,
    text_stage: "finalized",
    finalize_via: via,
  };
}

export function withManualTranscribeStage(seg: SegmentDto): SegmentDto {
  return { ...seg, text_stage: "manual_transcribe", finalize_via: clearedFinalize() };
}

export function withAiRevisedStage(seg: SegmentDto): SegmentDto {
  return { ...seg, text_stage: "ai_revised", finalize_via: clearedFinalize() };
}

export function withAutoTranscribeStage(seg: SegmentDto): SegmentDto {
  return { ...seg, text_stage: DEFAULT_SEGMENT_TEXT_STAGE, finalize_via: clearedFinalize() };
}

function savedTextForSegment(savedSnapshot: SegmentDto[], seg: SegmentDto, idx: number): string {
  const uid = seg.uid?.trim();
  const saved = uid ? savedSnapshot.find((s) => s.uid?.trim() === uid) : savedSnapshot[idx];
  return saved?.text ?? "";
}

/** 普通 save 前：正文相对 savedSnapshot 变更 → manual_transcribe。 */
export function applyManualTranscribeStageOnTextSave(
  segments: SegmentDto[],
  savedSnapshot: SegmentDto[],
): SegmentDto[] {
  return segments.map((seg, idx) => {
    if (seg.text === savedTextForSegment(savedSnapshot, seg, idx)) return seg;
    return withManualTranscribeStage(seg);
  });
}

/** LLM 写回：变更 uid 集合 → ai_revised。 */
export function applyAiRevisedStageToUids(
  segments: SegmentDto[],
  changedUids: ReadonlySet<string>,
): SegmentDto[] {
  if (changedUids.size === 0) return segments;
  return segments.map((seg) => {
    const uid = seg.uid?.trim();
    if (!uid || !changedUids.has(uid)) return seg;
    return withAiRevisedStage(seg);
  });
}

export type FinalizeStageIntent = {
  segmentIdx: number;
  hadUnsavedDraft: boolean;
};

export type StagePersistOptions = {
  finalizeIntent?: FinalizeStageIntent;
  /** 本次 save 由 LLM 写回且文本变更的 uid；须在 manual 升阶之后再次标 ai_revised。 */
  aiRevisedUids?: ReadonlySet<string>;
};

export function applyStagePatchesBeforePersist(
  segments: SegmentDto[],
  savedSnapshot: SegmentDto[],
  options?: FinalizeStageIntent | StagePersistOptions,
): SegmentDto[] {
  const opts: StagePersistOptions =
    options && "segmentIdx" in options ? { finalizeIntent: options } : (options ?? {});
  let next = applyManualTranscribeStageOnTextSave(segments, savedSnapshot);
  if (opts.aiRevisedUids?.size) {
    next = applyAiRevisedStageToUids(next, opts.aiRevisedUids);
  }
  const intent = opts.finalizeIntent;
  if (!intent) return next;
  return next.map((seg, idx) => {
    if (idx !== intent.segmentIdx) return seg;
    return withFinalizedStage(seg, intent.hadUnsavedDraft ? "confirm_edit" : "mark_only");
  });
}

export function allSegmentsAutoTranscribe(segments: SegmentDto[]): SegmentDto[] {
  return segments.map((seg) => withAutoTranscribeStage(seg));
}

export function mergeSegmentStageKeepLeft(left: SegmentDto): SegmentTextStage {
  return left.text_stage ?? DEFAULT_SEGMENT_TEXT_STAGE;
}

function mergedFinalizeVia(left: SegmentDto, right: SegmentDto): SegmentFinalizeVia | null {
  const leftFinalized = normalizeSegmentTextStage(left.text_stage) === "finalized";
  const rightFinalized = normalizeSegmentTextStage(right.text_stage) === "finalized";
  const leftVia = leftFinalized ? left.finalize_via : null;
  const rightVia = rightFinalized ? right.finalize_via : null;
  if (leftVia === "mark_only" || rightVia === "mark_only") return "mark_only";
  if (leftVia === "confirm_edit" || rightVia === "confirm_edit") return "confirm_edit";
  return null;
}

/** 合并语段：stage 取两段中确信度较低者；非定稿时清空 finalize_via。 */
export function mergeSegmentStageFields(
  left: SegmentDto,
  right: SegmentDto,
): Pick<SegmentDto, "text_stage" | "finalize_via"> {
  const text_stage = leastConfirmedSegmentStage(left.text_stage, right.text_stage);
  return {
    text_stage,
    finalize_via: text_stage === "finalized" ? mergedFinalizeVia(left, right) : null,
  };
}

/** 拆分左半：继承 parent stage（Plan B12 左段）。 */
export function inheritSplitLeftStage(parent: SegmentDto): Pick<SegmentDto, "text_stage" | "finalize_via"> {
  const text_stage = parent.text_stage ?? DEFAULT_SEGMENT_TEXT_STAGE;
  return {
    text_stage,
    finalize_via: text_stage === "finalized" ? (parent.finalize_via ?? null) : null,
  };
}
