import {
  isContiguousIndexSelection,
  selectionEnvelope,
} from "../../utils/segmentSelection";
import { getSelectionChromeSnapshot } from "./selectionChromeStore";

export type WaveformSelectionChromeReactInput = {
  fileId: string | null;
  selectedIdx: number;
  selectedIndices?: ReadonlySet<number>;
  selectionLo?: number;
  selectionHi?: number;
  selectionCount?: number;
  isContiguousSelection?: boolean;
  /** When set, ignore store primary that is out of range (post merge/delete). */
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

/** SC2 visual selection for waveform band + overlay — store leads React SC1 until transition catches up. */
export function resolveWaveformSelectionChromeView(
  input: WaveformSelectionChromeReactInput,
): WaveformSelectionChromeView {
  // filterExcludesPrimary intentionally ignored: keep pink primary + list banner (SC-H6).
  void input.filterExcludesPrimary;

  const snap = getSelectionChromeSnapshot();
  const segmentCount = input.segmentCount;
  if (
    input.fileId == null ||
    snap.fileId !== input.fileId ||
    snap.primaryIdx < 0 ||
    (segmentCount != null && snap.primaryIdx >= segmentCount)
  ) {
    return fromReact(input);
  }

  const env = selectionEnvelope(snap.selectedSet);
  if (!env) {
    return fromReact(input);
  }

  return {
    selectedIdx: snap.primaryIdx,
    selectedIndices: snap.selectedSet,
    selectionLo: env.lo,
    selectionHi: env.hi,
    selectionCount: env.count,
    isContiguousSelection: isContiguousIndexSelection(snap.selectedSet),
  };
}
