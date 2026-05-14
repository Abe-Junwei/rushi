import type { SegmentDto } from "../tauri/projectApi";

/** 稳定 bounds 签名，避免浮点抖动或纯文本编辑触发下游同步。 */
export function roundSec3(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 1000) / 1000;
}

/** 波形 regions：起止 + 低置信（影响 region 色） */
export function waveformBoundsSignature(
  segments: Pick<SegmentDto, "start_sec" | "end_sec" | "low_confidence">[],
): string {
  return segments
    .map((s) => `${roundSec3(s.start_sec)}\t${roundSec3(s.end_sec)}\t${s.low_confidence ? 1 : 0}`)
    .join("|");
}

/** 语段车道分配：仅起止（与 assignSegmentOverlapLanes 输入一致） */
export function p1LaneBoundsSignature(segments: Pick<SegmentDto, "start_sec" | "end_sec">[]): string {
  return segments.map((s) => `${roundSec3(s.start_sec)}\t${roundSec3(s.end_sec)}`).join("|");
}
