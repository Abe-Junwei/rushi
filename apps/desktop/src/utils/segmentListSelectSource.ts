import type { SegmentSelectSource } from "./waveformViewMode";

/** 列表连点间隔内用 listAdvance（仍 reveal、不 seek；source 供分析/快捷键区分）。 */
export const LIST_RAPID_SELECT_MS = 400;

/** 列表内切语段（点击 / 连点 / ↑↓）— 优先即时 scroll + chrome，不走 waveform 重路径。 */
export function isListSegmentSelectSource(source: SegmentSelectSource): boolean {
  return source === "list" || source === "listAdvance" || source === "listKeyboard";
}

export type ListSelectSourceState = {
  lastAtMs: number;
};

/** 首次或间隔足够长 → list；短时间连点 → listAdvance。 */
export function nextListSelectSource(
  nowMs: number,
  state: ListSelectSourceState,
): SegmentSelectSource {
  const elapsed = nowMs - state.lastAtMs;
  state.lastAtMs = nowMs;
  return elapsed < LIST_RAPID_SELECT_MS ? "listAdvance" : "list";
}
