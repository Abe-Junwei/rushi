import type { SegmentDto } from "../tauri/projectApi";
import { segmentFillCssVar } from "../config/segmentFillTokens";
import { segmentBandFillStyle } from "./waveformSegmentBandCanvasColors";
import { readWaveformSegmentBandPalette } from "./waveformThemeColors";

/** 播放头已进入语段（含部分播放）；小 epsilon 避免边界闪烁。 */
const PLAYHEAD_EPS_SEC = 0.04;

export function resolveVisitedSegmentIndexAtPlayhead(
  segments: readonly { start_sec: number; end_sec: number }[],
  playheadSec: number,
): number {
  if (!Number.isFinite(playheadSec) || segments.length === 0) return -1;
  let lo = 0;
  let hi = segments.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const start = Math.min(segments[mid]!.start_sec, segments[mid]!.end_sec);
    if (playheadSec > start + PLAYHEAD_EPS_SEC) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export type SegmentPlaybackVisits = "unplayed" | "visited";

export function segmentPlaybackVisits(
  seg: SegmentDto,
  playheadSec: number | undefined,
): SegmentPlaybackVisits {
  if (playheadSec == null || !Number.isFinite(playheadSec)) return "unplayed";
  const lo = Math.min(seg.start_sec, seg.end_sec);
  return playheadSec > lo + PLAYHEAD_EPS_SEC ? "visited" : "unplayed";
}

export type WaveformSegmentFillState = {
  selected: boolean;
  inSelection: boolean;
  multiSelectActive: boolean;
};

function isIndexInWaveformSelection(input: {
  idx: number;
  selectedIdx: number;
  selectedIndices?: ReadonlySet<number>;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
}): boolean {
  if (input.selectedIndices && input.selectedIndices.size > 0) {
    return input.selectedIndices.has(input.idx);
  }
  const lo = Math.min(input.selectionLo ?? input.selectedIdx, input.selectionHi ?? input.selectedIdx);
  const hi = Math.max(input.selectionLo ?? input.selectedIdx, input.selectionHi ?? input.selectedIdx);
  return (input.selectionCount ?? 0) > 1 && input.idx >= lo && input.idx <= hi;
}

/** 波形语段选中态 — overlay DOM 与 band canvas 共用；selectedIndices 优先，范围字段作回退。 */
export function resolveWaveformSegmentFillState(input: {
  idx: number;
  selectedIdx: number;
  selectedIndices?: ReadonlySet<number>;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
}): WaveformSegmentFillState {
  const selected = input.idx === input.selectedIdx;
  const multiSelectActive =
    (input.selectedIndices?.size ?? 0) > 1 || (input.selectionCount ?? 0) > 1;
  const inSelection = !selected && multiSelectActive && isIndexInWaveformSelection(input);
  return { selected, inSelection, multiSelectActive };
}

/**
 * 波形语段 overlay 填充 — 引用 tokens.css `--segment-fill-*`，随壳层 / 主题色即时更新。
 */
export function waveformRegionFillColor(
  seg: SegmentDto,
  selected: boolean,
  inSelection = false,
  playheadSec?: number,
  options?: { multiSelectActive?: boolean },
): string {
  void playheadSec;
  if (options?.multiSelectActive && (selected || inSelection)) {
    return segmentFillCssVar("inSelectionWaveform");
  }
  if (selected) return segmentFillCssVar("selected");
  if (inSelection) return segmentFillCssVar("inSelectionWaveform");
  if (seg.low_confidence) return segmentFillCssVar("lowConfidence");
  return segmentFillCssVar("idle");
}

/** Resolved rgba for CSP layout / imperative overlay — matches band canvas palette. */
export function resolveWaveformRegionFillColor(
  seg: SegmentDto,
  selected: boolean,
  inSelection = false,
  playheadSec?: number,
  options?: { multiSelectActive?: boolean },
): string {
  return segmentBandFillStyle(seg, selected, playheadSec, readWaveformSegmentBandPalette(), {
    inSelection,
    multiSelectActive: options?.multiSelectActive,
  });
}
