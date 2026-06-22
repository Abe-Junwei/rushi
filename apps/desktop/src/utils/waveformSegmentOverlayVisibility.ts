import type { SegmentDto } from "../tauri/projectApi";
import {
  MAX_DOM_OVERLAY_SPARSE,
  resolveWaveformSelectionRenderProjection,
  selectWaveformOverlayInteractiveIndices,
} from "../services/waveform/waveformSelectionRenderProjection";

/** Max DOM overlay regions for sparse multi-select; larger sets rely on canvas band. */
export { MAX_DOM_OVERLAY_SPARSE };

export function selectOverlayRenderedSegmentIndices(input: {
  segments: SegmentDto[];
  dominantSpanIndices?: readonly number[];
}): number[] {
  const dominant = new Set(input.dominantSpanIndices ?? []);
  const out: number[] = [];
  for (let idx = 0; idx < input.segments.length; idx += 1) {
    if (!dominant.has(idx)) out.push(idx);
  }
  return out;
}

/** DOM overlay / canvas skip indices: explicit set + contiguous range + draft. */
export function selectOverlayInteractiveSegmentIndices(input: {
  segmentCount: number;
  selectedIdx: number;
  selectedIndices?: ReadonlySet<number>;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
  isContiguousSelection?: boolean;
  draftIdx: number | null;
}): number[] {
  return selectWaveformOverlayInteractiveIndices(input);
}

/**
 * Band canvas skip set — DOM overlay indices; primary skipped when overlay node exists.
 * When overlay DOM is missing, primary stays band-painted to avoid a white gap before React mount.
 */
export function resolveSegmentBandCanvasSkipIndexSet(input: {
  segmentCount: number;
  selectedIdx: number;
  selectedIndices?: ReadonlySet<number>;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
  isContiguousSelection?: boolean;
  draftIdx: number | null;
  overlayRoot?: ParentNode | null;
}): ReadonlySet<number> {
  return resolveWaveformSelectionRenderProjection(input).canvasSkipIndexSet;
}
