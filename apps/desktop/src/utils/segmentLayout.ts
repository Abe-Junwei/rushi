import type { SegmentDto } from "../tauri/projectApi";
import {
  clampTranscriptFontPx,
  TRANSCRIPT_FONT_DEFAULT,
  TRANSCRIPT_FONT_MAX,
  TRANSCRIPT_FONT_MIN,
} from "./waveformPrefs";
import { computeTimelineWidthPx } from "./pxPerSec";
export { computeTimelineWidthPx };

/** 语段卡行高（px）：支持元信息与两行正文的编辑卡。 */
export function computeSegmentLaneRowPx(transcriptFontPx: number): number {
  const f = clampTranscriptFontPx(transcriptFontPx);
  const linePx = Math.ceil(f * 1.55);
  const headerAndControlsPx = 26;
  const bodyPx = Math.ceil(linePx * 2);
  return Math.max(64, headerAndControlsPx + bodyPx);
}

export const SEGMENT_LANE_ROW_MIN_PX = computeSegmentLaneRowPx(TRANSCRIPT_FONT_MIN);
export const SEGMENT_LANE_ROW_MAX_PX = computeSegmentLaneRowPx(TRANSCRIPT_FONT_MAX);

export function clampSegmentLaneRowPx(px: number): number {
  return Math.min(SEGMENT_LANE_ROW_MAX_PX, Math.max(SEGMENT_LANE_ROW_MIN_PX, Math.round(px)));
}

export function transcriptFontPxFromSegmentRowPx(rowPx: number): number {
  const target = clampSegmentLaneRowPx(rowPx);
  let bestFont = TRANSCRIPT_FONT_DEFAULT;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (let f = TRANSCRIPT_FONT_MIN; f <= TRANSCRIPT_FONT_MAX; f += 1) {
    const diff = Math.abs(computeSegmentLaneRowPx(f) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestFont = f;
    }
  }
  return bestFont;
}

/** 默认字号下的语段卡行高（供测试与布局常量引用）。 */
export const SEGMENT_LANE_ROW_PX = computeSegmentLaneRowPx(TRANSCRIPT_FONT_DEFAULT);

/**
 * 将语段分配到最少数量的「车道」，使时间重叠的语段不在同一车道相邻占用（贪心按开始时间排序）。
 * 用于单条时间轨上垂直错开放置。
 */
export function assignSegmentOverlapLanes(
  segments: Pick<SegmentDto, "start_sec" | "end_sec">[],
): { laneByIndex: number[]; laneCount: number } {
  const n = segments.length;
  if (n === 0) return { laneByIndex: [], laneCount: 0 };

  const idxs = Array.from({ length: n }, (_, j) => j).sort((a, b) => {
    const d = segments[a].start_sec - segments[b].start_sec;
    return d !== 0 ? d : segments[a].end_sec - segments[b].end_sec;
  });

  const laneEnds: number[] = [];
  const laneByIndex = new Array<number>(n).fill(0);

  for (const i of idxs) {
    const s = segments[i];
    const lo = Math.min(s.start_sec, s.end_sec);
    const hi = Math.max(s.start_sec, s.end_sec);
    let chosen = -1;
    for (let k = 0; k < laneEnds.length; k++) {
      if (laneEnds[k] <= lo + 1e-9) {
        chosen = k;
        break;
      }
    }
    if (chosen < 0) {
      chosen = laneEnds.length;
      laneEnds.push(hi);
    } else {
      laneEnds[chosen] = hi;
    }
    laneByIndex[i] = chosen;
  }

  return { laneByIndex, laneCount: laneEnds.length };
}


