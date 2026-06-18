import { LIST_ADVANCE_PLAY_COALESCE_MS } from "./scheduleListAdvanceSegmentPlayback";
import type { SegmentSelectSource } from "./waveformViewMode";

/** 列表连点间隔内用 listAdvance，避免重复 zoomToFitSegment。 */
export const LIST_RAPID_SELECT_MS = 400;

/** 列表滚入视口：仅 ↑↓ / 连点推进合并延迟；点击/波形选中立即滚动。 */
export function segmentListScrollCoalesceMs(source: SegmentSelectSource): number {
  return source === "listKeyboard" || source === "listAdvance"
    ? LIST_ADVANCE_PLAY_COALESCE_MS
    : 0;
}

export type ListSelectSourceState = {
  lastAtMs: number;
};

/** 首次或间隔足够长 → list（zoom）；短时间连点 → listAdvance（reveal only）。 */
export function nextListSelectSource(
  nowMs: number,
  state: ListSelectSourceState,
): SegmentSelectSource {
  const elapsed = nowMs - state.lastAtMs;
  state.lastAtMs = nowMs;
  return elapsed < LIST_RAPID_SELECT_MS ? "listAdvance" : "list";
}
