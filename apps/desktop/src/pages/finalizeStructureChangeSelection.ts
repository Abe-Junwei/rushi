import type { SegmentDto } from "../tauri/projectApi";
import { resolveSegmentIdxContainingPlayhead } from "../utils/segmentPlaybackStructureRemap";

/**
 * After split/merge publish: select the playhead-containing segment and remap sticky playback.
 *
 * Guard (decision 1 premise): playhead-driven selection only applies when the playhead falls
 * inside the edited segment's `affectedBounds`. Otherwise selection keeps the natural post-op
 * index (`fallbackIdx`, e.g. split right half / merge target) instead of jumping to an
 * unrelated segment elsewhere on the timeline. Sticky playback still remaps by playhead
 * geometry, since media resumes wherever the playhead actually is.
 */
export function finalizeStructureChangeSelection(input: {
  segments: readonly SegmentDto[];
  playheadSec: number;
  setSelectedIdx: (idx: number) => void;
  onSelectionCollapsed?: (idx: number) => void;
  onStructurePlaybackRemap?: (
    playheadSec: number,
    segments: readonly SegmentDto[],
  ) => void;
  /** Natural post-op index used when the playhead is outside `affectedBounds`. */
  fallbackIdx?: number;
  /** Edited segment span; playhead inside → follow playhead half, else fallback. */
  affectedBounds?: { startSec: number; endSec: number };
}): number {
  const containing = resolveSegmentIdxContainingPlayhead(input.segments, input.playheadSec);
  if (containing < 0) return -1;

  let idx = containing;
  if (input.affectedBounds) {
    const lo = Math.min(input.affectedBounds.startSec, input.affectedBounds.endSec);
    const hi = Math.max(input.affectedBounds.startSec, input.affectedBounds.endSec);
    const inside = input.playheadSec >= lo && input.playheadSec < hi;
    if (!inside && input.fallbackIdx != null) {
      idx = input.fallbackIdx;
    }
  }
  if (idx < 0 || idx >= input.segments.length) {
    idx = Math.max(0, Math.min(idx, input.segments.length - 1));
  }

  input.setSelectedIdx(idx);
  input.onSelectionCollapsed?.(idx);
  // Pass post-mutation snapshot — waveform refs may not have re-rendered yet.
  input.onStructurePlaybackRemap?.(input.playheadSec, input.segments);
  return idx;
}
