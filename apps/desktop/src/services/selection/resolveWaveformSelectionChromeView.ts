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
  /** SC-H6: list filter hides the current primary — suppress waveform SC2 paint. */
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

function emptyWaveformSelectionView(): WaveformSelectionChromeView {
  return {
    selectedIdx: -1,
    selectedIndices: undefined,
    selectionLo: -1,
    selectionHi: -1,
    selectionCount: 0,
    isContiguousSelection: false,
  };
}

/** SC2 visual selection for waveform band + overlay — store leads React SC1 until transition catches up. */
export function resolveWaveformSelectionChromeView(
  input: WaveformSelectionChromeReactInput,
): WaveformSelectionChromeView {
  if (input.filterExcludesPrimary) {
    return emptyWaveformSelectionView();
  }

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
