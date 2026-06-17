import type { SegmentDto } from "../tauri/projectApi";
import { segmentPlaybackVisits } from "./segmentChrome";
import {
  readWaveformSegmentBandPalette,
  type WaveformSegmentBandPalette,
} from "./waveformThemeColors";

export function segmentBandFillStyle(
  seg: SegmentDto,
  selected: boolean,
  playheadSec: number | undefined,
  palette: WaveformSegmentBandPalette = readWaveformSegmentBandPalette(),
): string {
  if (selected) return palette.selected;
  if (seg.low_confidence) return palette.lowConfidence;
  if (segmentPlaybackVisits(seg, playheadSec) === "visited") return palette.visited;
  return palette.idle;
}

export { readWaveformSegmentBandPalette };
