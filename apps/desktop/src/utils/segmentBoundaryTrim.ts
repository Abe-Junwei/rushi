import type { SegmentDto } from "../tauri/projectApi";
import { roundSec3 } from "./boundsSignature";
import { WAVEFORM_SEGMENT_MIN_SPAN_SEC } from "./waveformSegmentBounds";

const BOUNDARY_EPS_SEC = 1e-6;

/**
 * 按时间升序消除相邻语段重叠：前句 end 对齐后句 start（ASR 拉取后的误判重叠）。
 * 若对齐后低于最小时长，则推后句 start（必要时扩后句 end）以保持可编辑跨度。
 */
export function trimAdjacentSegmentOverlaps(segs: SegmentDto[]): SegmentDto[] {
  if (segs.length < 2) return segs;
  const out = segs.map((s) => ({ ...s }));
  for (let i = 0; i < out.length - 1; i += 1) {
    const cur = out[i];
    const next = out[i + 1];
    if (!cur || !next) continue;
    if (cur.end_sec <= next.start_sec + BOUNDARY_EPS_SEC) continue;

    cur.end_sec = roundSec3(next.start_sec);
    const curMinEnd = cur.start_sec + WAVEFORM_SEGMENT_MIN_SPAN_SEC;
    if (cur.end_sec + BOUNDARY_EPS_SEC < curMinEnd) {
      cur.end_sec = roundSec3(curMinEnd);
    }
    if (cur.end_sec > next.start_sec + BOUNDARY_EPS_SEC) {
      next.start_sec = roundSec3(cur.end_sec);
      const nextMinEnd = next.start_sec + WAVEFORM_SEGMENT_MIN_SPAN_SEC;
      if (next.end_sec + BOUNDARY_EPS_SEC < nextMinEnd) {
        next.end_sec = roundSec3(nextMinEnd);
      }
    }
  }
  return out;
}
