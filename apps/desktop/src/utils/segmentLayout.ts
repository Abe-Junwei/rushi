import type { SegmentDto } from "../tauri/projectApi";
import { clampTranscriptFontPx, TRANSCRIPT_FONT_DEFAULT } from "./waveformPrefs";

/** 语段卡行高（px）：单行正文 + 上下内边距，随正文字号略增。 */
export function computeSegmentLaneRowPx(transcriptFontPx: number): number {
  const f = clampTranscriptFontPx(transcriptFontPx);
  const linePx = Math.ceil(f * 1.45);
  const verticalPad = 24;
  return Math.max(28, verticalPad + linePx);
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

/**
 * 时间轴总宽 = 媒体时长 × 像素/秒（与 WaveSurfer `minPxPerSec` 一致）。
 * 若与波形可滚宽度不一致，会导致 tier 与波形横向错位、语段卡与 region 对不齐。
 */
export function computeTimelineWidthPx(durationSec: number, pxPerSec: number): number {
  const floor = 320;
  const sec = Math.max(durationSec, 0.5);
  return Math.max(Math.ceil(sec * pxPerSec), floor);
}
