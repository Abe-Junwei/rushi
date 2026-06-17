import type { SegmentDto } from "../tauri/projectApi";

/** 播放头已进入语段（含部分播放）；小 epsilon 避免边界闪烁。 */
const PLAYHEAD_EPS_SEC = 0.04;

export type SegmentPlaybackVisits = "unplayed" | "visited";

export function segmentPlaybackVisits(
  seg: SegmentDto,
  playheadSec: number | undefined,
): SegmentPlaybackVisits {
  if (playheadSec == null || !Number.isFinite(playheadSec)) return "unplayed";
  const lo = Math.min(seg.start_sec, seg.end_sec);
  return playheadSec > lo + PLAYHEAD_EPS_SEC ? "visited" : "unplayed";
}

/**
 * 波形语段 overlay 填充 — 引用 CSS 变量，随界面主题 / 主题色即时更新。
 */
export function waveformRegionFillColor(
  seg: SegmentDto,
  selected: boolean,
  inSelection = false,
  playheadSec?: number,
): string {
  if (selected) {
    return "color-mix(in srgb, var(--accent-edit) 26%, transparent)";
  }
  if (inSelection) {
    return "color-mix(in srgb, var(--accent-edit) 20%, transparent)";
  }
  if (seg.low_confidence) {
    return "color-mix(in srgb, var(--notion-text-light) 24%, transparent)";
  }
  if (segmentPlaybackVisits(seg, playheadSec) === "visited") {
    return "color-mix(in srgb, var(--zen-saffron-mid) 13%, transparent)";
  }
  return "color-mix(in srgb, var(--zen-ink) 11%, transparent)";
}
