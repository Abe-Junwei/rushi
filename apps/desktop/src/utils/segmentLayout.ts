import type { SegmentDto } from "../tauri/projectApi";
import { selectPackableSegmentIndices } from "./waveformSegmentBounds";
import {
  clampTranscriptFontPx,
  TRANSCRIPT_FONT_DEFAULT,
  TRANSCRIPT_FONT_MAX,
  TRANSCRIPT_FONT_MIN,
} from "./waveformPrefs";
import { computeTimelineWidthPx } from "./pxPerSec";
export { computeTimelineWidthPx };

/** 语段下方/底部拖调字号：每 1px 字号所需的 pointer Y 位移（越大越精细）。 */
export const TRANSCRIPT_FONT_DRAG_PX_PER_STEP = 8;

export function transcriptFontPxFromDragDelta(
  startFontPx: number,
  deltaYPx: number,
  pxPerStep: number = TRANSCRIPT_FONT_DRAG_PX_PER_STEP,
): number {
  if (pxPerStep <= 0) return clampTranscriptFontPx(startFontPx);
  return clampTranscriptFontPx(startFontPx + Math.trunc(deltaYPx / pxPerStep));
}

/** 语段卡行高（px）：支持元信息与两行正文的编辑卡。 */
export function computeSegmentLaneRowPx(transcriptFontPx: number): number {
  const f = clampTranscriptFontPx(transcriptFontPx);
  const linePx = Math.ceil(f * 1.55);
  const headerAndControlsPx = 26;
  const bodyPx = Math.ceil(linePx * 2);
  return Math.max(64, headerAndControlsPx + bodyPx);
}

const SEGMENT_LANE_ROW_MIN_PX = computeSegmentLaneRowPx(TRANSCRIPT_FONT_MIN);
const SEGMENT_LANE_ROW_MAX_PX = computeSegmentLaneRowPx(TRANSCRIPT_FONT_MAX);

export function clampSegmentLaneRowPx(px: number): number {
  return Math.min(SEGMENT_LANE_ROW_MAX_PX, Math.max(SEGMENT_LANE_ROW_MIN_PX, Math.round(px)));
}

export function transcriptFontPxFromSegmentRowPx(rowPx: number): number {
  const target = clampSegmentLaneRowPx(rowPx);
  let bestFont = TRANSCRIPT_FONT_DEFAULT;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let f = TRANSCRIPT_FONT_MIN; f <= TRANSCRIPT_FONT_MAX; f += 1) {
    const diff = Math.abs(computeSegmentLaneRowPx(f) - target);
    if (bestDiff > diff) {
      bestDiff = diff;
      bestFont = f;
    }
  }
  return bestFont;
}

/** 默认字号下的语段卡行高（供测试与布局常量引用）。 */
export const SEGMENT_LANE_ROW_PX = computeSegmentLaneRowPx(TRANSCRIPT_FONT_DEFAULT);

/** 重叠超过此阈值且非包含关系时，才拆分到不同 lane（避免 ASR 微重叠把条带压成半高）。 */
const SEGMENT_LANE_OVERLAP_SEPARATE_SEC = 0.05;

/** ASR 相邻语段常见的尾/头边界重叠上限；超过才视为真并行（需分 lane）。 */
const SEGMENT_LANE_BOUNDARY_OVERLAP_MAX_SEC = 2.0;

type SegmentSpan = { startSec: number; endSec: number };

function normalizeSpan(span: SegmentSpan): { lo: number; hi: number } {
  return {
    lo: Math.min(span.startSec, span.endSec),
    hi: Math.max(span.startSec, span.endSec),
  };
}

/** 是否为 ASR/字幕常见的「前句 end 略大于后句 start」边界重叠（非并行说话）。 */
function isSequentialBoundaryOverlap(a: SegmentSpan, b: SegmentSpan): boolean {
  const { lo: aLo, hi: aHi } = normalizeSpan(a);
  const { lo: bLo, hi: bHi } = normalizeSpan(b);
  const overlap = Math.min(aHi, bHi) - Math.max(aLo, bLo);
  if (overlap <= SEGMENT_LANE_OVERLAP_SEPARATE_SEC) return true;
  const [first, second] =
    aLo <= bLo ? [{ lo: aLo, hi: aHi }, { lo: bLo, hi: bHi }] : [{ lo: bLo, hi: bHi }, { lo: aLo, hi: aHi }];
  // 后句起点距前句结束很近（尾/头交界）→ ASR 边界重叠，共享 lane。
  const tailGap = first.hi - second.lo;
  return tailGap >= 0 && tailGap <= SEGMENT_LANE_BOUNDARY_OVERLAP_MAX_SEC;
}

/** 两语段时间上是否必须分到不同 lane（真并行重叠；忽略微重叠、包含关系与 ASR 边界重叠）。 */
function segmentSpansNeedSeparateLanes(a: SegmentSpan, b: SegmentSpan): boolean {
  const { lo: aLo, hi: aHi } = normalizeSpan(a);
  const { lo: bLo, hi: bHi } = normalizeSpan(b);
  const overlap = Math.min(aHi, bHi) - Math.max(aLo, bLo);
  if (overlap <= SEGMENT_LANE_OVERLAP_SEPARATE_SEC) return false;
  const aContainsB = aLo <= bLo + 1e-9 && aHi >= bHi - 1e-9;
  const bContainsA = bLo <= aLo + 1e-9 && bHi >= aHi - 1e-9;
  if (aContainsB || bContainsA) return false;
  if (isSequentialBoundaryOverlap(a, b)) return false;
  return true;
}

/**
 * 将语段分配到最少数量的「车道」，使时间重叠的语段不在同一车道相邻占用（贪心按开始时间排序）。
 * 用于单条时间轨上垂直错开放置。
 */
export function assignSegmentOverlapLanes(
  segments: Pick<SegmentDto, "start_sec" | "end_sec">[],
  durationSec = 0,
): { laneByIndex: number[]; laneCount: number; dominantSpanIndices: number[] } {
  const n = segments.length;
  if (n === 0) return { laneByIndex: [], laneCount: 0, dominantSpanIndices: [] };

  const { packableIndices, dominantSpanIndices } = selectPackableSegmentIndices(
    segments,
    durationSec,
  );

  const laneByIndex = new Array<number>(n).fill(0);
  if (packableIndices.length === 0) {
    return { laneByIndex, laneCount: 0, dominantSpanIndices };
  }

  const idxs = [...packableIndices].sort((a, b) => {
    const d = segments[a].start_sec - segments[b].start_sec;
    return d !== 0 ? d : segments[a].end_sec - segments[b].end_sec;
  });

  const laneMembers: number[][] = [];

  for (const i of idxs) {
    const s = segments[i];
    const span = { startSec: s.start_sec, endSec: s.end_sec };
    let chosen = -1;
    for (let k = 0; k < laneMembers.length; k += 1) {
      const canShare = laneMembers[k].every((j) =>
        !segmentSpansNeedSeparateLanes(span, {
          startSec: segments[j].start_sec,
          endSec: segments[j].end_sec,
        }),
      );
      if (canShare) {
        chosen = k;
        break;
      }
    }
    if (chosen < 0) {
      chosen = laneMembers.length;
      laneMembers.push([]);
    }
    laneMembers[chosen].push(i);
    laneByIndex[i] = chosen;
  }

  return { laneByIndex, laneCount: laneMembers.length, dominantSpanIndices };
}
