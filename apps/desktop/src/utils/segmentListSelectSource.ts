import type { SegmentSelectSource } from "./waveformViewMode";

/** 列表连点间隔内用 listAdvance，避免重复 zoomToFitSegment。 */
export const LIST_RAPID_SELECT_MS = 400;

/** 选中语段后的列表滚入视口必须即时，避免切换语段时出现可感知跳转延迟。 */
export function segmentListScrollCoalesceMs(source: SegmentSelectSource): number {
  void source;
  return 0;
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
