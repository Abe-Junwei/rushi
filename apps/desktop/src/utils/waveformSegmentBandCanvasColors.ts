import type { SegmentDto } from "../tauri/projectApi";
import {
  readWaveformSegmentBandPalette,
  type WaveformSegmentBandPalette,
} from "./waveformThemeColors";

/** Align with segmentChrome.segmentPlaybackVisits (avoid circular import). */
const PLAYHEAD_EPS_SEC = 0.04;

export function segmentBandFillStyle(
  seg: SegmentDto,
  selected: boolean,
  playheadSec: number | undefined,
  palette: WaveformSegmentBandPalette = readWaveformSegmentBandPalette(),
  options?: { inSelection?: boolean; multiSelectActive?: boolean },
): string {
  // Frozen: never paint saffron selected / in-selection washes.
  if (seg.frozen) {
    if (seg.low_confidence) return palette.lowConfidence;
    return palette.idle;
  }
  if (options?.multiSelectActive && (selected || options.inSelection)) {
    return palette.inSelection;
  }
  if (selected) return palette.selected;
  if (options?.inSelection) return palette.inSelection;
  if (seg.low_confidence) return palette.lowConfidence;
  if (
    playheadSec != null &&
    Number.isFinite(playheadSec) &&
    playheadSec > Math.min(seg.start_sec, seg.end_sec) + PLAYHEAD_EPS_SEC
  ) {
    return palette.visited;
  }
  return palette.idle;
}

export { readWaveformSegmentBandPalette };
