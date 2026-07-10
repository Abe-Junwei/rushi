import {
  isContiguousIndexSelection,
  selectionEnvelope,
} from "../../../utils/segmentSelection";
import type { WaveformSelectionChromeView } from "../../../services/selection/resolveWaveformSelectionChromeView";
import {
  getTranscriptProjectionSnapshot,
  type TranscriptProjectionSnapshot,
} from "./transcriptProjection";

/** Map CM6 projection → waveform chrome view shape. */
export function waveformSelectionViewFromProjection(
  snap: TranscriptProjectionSnapshot,
  segmentCount?: number,
): WaveformSelectionChromeView | null {
  if (snap.primaryIdx < 0) return null;
  if (segmentCount != null && snap.primaryIdx >= segmentCount) return null;
  const env = selectionEnvelope(snap.selectedSet);
  if (!env) return null;
  return {
    selectedIdx: snap.primaryIdx,
    selectedIndices: snap.selectedSet,
    selectionLo: env.lo,
    selectionHi: env.hi,
    selectionCount: env.count,
    isContiguousSelection: isContiguousIndexSelection(snap.selectedSet),
  };
}

/**
 * CM6 projection primary; if projection empty, SC1 bridge (`fallbackIdx`).
 * Does not read SC2 store (P9b1).
 */
export function effectiveTranscriptPrimaryIdx(fallbackIdx: number): number {
  const primary = getTranscriptProjectionSnapshot().primaryIdx;
  if (primary >= 0) return primary;
  return fallbackIdx;
}
