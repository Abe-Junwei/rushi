import type { SegmentDto } from "../tauri/projectApi";
import { resolveSegmentIndexAtWaveformPointer } from "./waveformSegmentBounds";

export type WaveformSegmentContextMenuHitInput = {
  segments: SegmentDto[];
  timeSec: number;
  pointerClientY: number;
  overlayClientTop: number;
  layoutHeightPx: number;
  layoutYScale: number;
  laneByIndex: number[];
  laneCount: number;
  selectedIdx: number;
  durationSec?: number;
  timelineWidthPx?: number;
};

/** Hit-test a waveform pointer for segment context menu (no DOM queries). */
export function resolveWaveformSegmentContextMenuIndex(
  input: WaveformSegmentContextMenuHitInput,
): number {
  return resolveSegmentIndexAtWaveformPointer({
    segments: input.segments,
    timeSec: input.timeSec,
    pointerClientY: input.pointerClientY,
    overlayClientTop: input.overlayClientTop,
    layoutHeightPx: input.layoutHeightPx,
    layoutYScale: input.layoutYScale,
    laneByIndex: input.laneByIndex,
    laneCount: input.laneCount,
    selectedIdx: input.selectedIdx,
    durationSec: input.durationSec ?? 0,
    timelineWidthPx: input.timelineWidthPx ?? 0,
  });
}
