import {
  isContiguousIndexSelection,
  selectionEnvelope,
} from "../../utils/segmentSelection";
import { getTranscriptProjectionSnapshot } from "../../components/editor/core/transcriptProjection";
import { waveformSelectionViewFromProjection } from "../../components/editor/core/projectionWaveformBridge";

export type WaveformSelectionChromeReactInput = {
  fileId: string | null;
  selectedIdx: number;
  selectedIndices?: ReadonlySet<number>;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
  isContiguousSelection?: boolean;
  /** When set, ignore projection primary that is out of range (post merge/delete). */
  segmentCount?: number;
  /**
   * @deprecated Kept for call-site compatibility. SC-H6 no longer clears chrome:
   * waveform keeps primary highlight; list shows the filter-exclusion banner.
   */
  filterExcludesPrimary?: boolean;
};

export type WaveformSelectionChromeView = {
  selectedIdx: number;
  selectedIndices?: ReadonlySet<number>;
  selectionLo: number;
  selectionHi: number;
  selectionCount: number;
  isContiguousSelection: boolean;
};

function fromReact(input: WaveformSelectionChromeReactInput): WaveformSelectionChromeView {
  const lo = input.selectionLo ?? input.selectedIdx;
  const hi = input.selectionHi ?? input.selectedIdx;
  const count = input.selectionCount ?? input.selectedIndices?.size ?? (input.selectedIdx >= 0 ? 1 : 0);
  return {
    selectedIdx: input.selectedIdx,
    selectedIndices: input.selectedIndices,
    selectionLo: lo,
    selectionHi: hi,
    selectionCount: count,
    isContiguousSelection: input.isContiguousSelection ?? false,
  };
}

/**
 * Waveform band/overlay selection view.
 * P9b2: CM6 transcriptProjection only (React input is fallback when projection empty/OOR).
 */
export function resolveWaveformSelectionChromeView(
  input: WaveformSelectionChromeReactInput,
): WaveformSelectionChromeView {
  void input.filterExcludesPrimary;

  const fromProj = waveformSelectionViewFromProjection(
    getTranscriptProjectionSnapshot(),
    input.segmentCount,
  );
  if (fromProj) return fromProj;
  return fromReact(input);
}

/** @deprecated Prefer resolveWaveformSelectionChromeView; kept for envelope helpers in tests. */
export function waveformSelectionViewFromIndices(
  primaryIdx: number,
  selectedSet: ReadonlySet<number>,
): WaveformSelectionChromeView | null {
  if (primaryIdx < 0) return null;
  const env = selectionEnvelope(selectedSet);
  if (!env) return null;
  return {
    selectedIdx: primaryIdx,
    selectedIndices: selectedSet,
    selectionLo: env.lo,
    selectionHi: env.hi,
    selectionCount: env.count,
    isContiguousSelection: isContiguousIndexSelection(selectedSet),
  };
}
