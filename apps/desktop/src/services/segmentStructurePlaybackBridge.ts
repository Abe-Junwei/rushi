/**
 * Cross-layer bridge: segment mutations (lifecycle) ↔ waveform playback (transcription).
 * Mutations remount above the waveform tree; register from useTranscriptionLayer.
 * Research: docs/execution/specs/segment-structure-playback-remap-research.md
 */
import type { SegmentDto } from "../tauri/projectApi";

export type SegmentStructurePlaybackBridge = {
  getPlayheadSec: () => number;
  /** Prefer post-mutation `segments` — waveform `latestSegmentsRef` may still be stale. */
  remapAfterStructureChange: (
    playheadSec: number,
    segments?: readonly SegmentDto[],
  ) => number;
};

let bridge: SegmentStructurePlaybackBridge | null = null;

/** Transcription / waveform registers while the editor media layer is mounted. */
export function registerSegmentStructurePlaybackBridge(
  next: SegmentStructurePlaybackBridge | null,
): void {
  bridge = next;
}

export function getStructurePlayheadSec(): number {
  try {
    const t = bridge?.getPlayheadSec();
    return typeof t === "number" && Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
}

/** Remap sticky session / pause / natural-end onto the playhead-containing segment. */
export function remapStructurePlayback(
  playheadSec: number,
  segments?: readonly SegmentDto[],
): void {
  try {
    bridge?.remapAfterStructureChange(playheadSec, segments);
  } catch {
    // Waveform may be unmounted during project close — ignore.
  }
}
