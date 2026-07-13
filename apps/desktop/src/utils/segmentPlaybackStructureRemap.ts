/**
 * After split/merge: map playhead time → segment index and remap sticky playback identity.
 * Research: docs/execution/specs/segment-structure-playback-remap-research.md
 */
import type { SegmentDto } from "../tauri/projectApi";

export type PlayheadSeamPolicy = "right";

/**
 * Index of the segment that contains `timeSec`.
 * Half-open [start, end): end is exclusive so a seam time belongs to the **right** neighbor.
 * If time falls in a gap, returns the nearest segment preferring the right side when tied.
 */
export function resolveSegmentIdxContainingPlayhead(
  segments: readonly SegmentDto[],
  timeSec: number,
  _seam: PlayheadSeamPolicy = "right",
): number {
  if (segments.length === 0) return -1;
  const t = Number.isFinite(timeSec) ? timeSec : 0;

  for (let i = 0; i < segments.length; i += 1) {
    const s = segments[i];
    if (!s) continue;
    const start = Math.min(s.start_sec, s.end_sec);
    const end = Math.max(s.start_sec, s.end_sec);
    if (t >= start && t < end) return i;
  }

  // Exact final end: treat as inside last segment (natural-stop latch).
  const last = segments[segments.length - 1];
  if (last) {
    const end = Math.max(last.start_sec, last.end_sec);
    if (t >= end && Math.abs(t - end) <= 0.05) return segments.length - 1;
  }

  // Gap: nearest by distance; tie → higher index (right).
  let bestIdx = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < segments.length; i += 1) {
    const s = segments[i];
    if (!s) continue;
    const start = Math.min(s.start_sec, s.end_sec);
    const end = Math.max(s.start_sec, s.end_sec);
    const dist = t < start ? start - t : t > end ? t - end : 0;
    if (dist < bestDist || (dist === bestDist && i > bestIdx)) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export type StructurePlaybackRemapInput = {
  segments: readonly SegmentDto[];
  playheadSec: number;
  /** Previous sticky natural-end marker (idx). */
  hadAutoStopped: boolean;
  /** Previous mid-pause anchor. */
  hadPausedAnchor: boolean;
};

export type StructurePlaybackRemapResult = {
  idx: number;
  /** Sticky natural-end: next play from segment start. */
  autoStoppedIdx: number | null;
  /** Mid-pause / preserve t on containing segment. */
  pausedAnchor: { idx: number; timeSec: number } | null;
  session: { kind: "segment"; idx: number } | null;
};

/**
 * Remap sticky playback identity onto the segment that contains the playhead.
 * - Natural-end sticky → autoStopped on new idx (replay from start).
 * - Mid-pause sticky → pausedAnchor at the same t on new idx.
 * - Otherwise still arms segment session on containing idx (Space follows playhead).
 */
export function resolveStructurePlaybackRemap(
  input: StructurePlaybackRemapInput,
): StructurePlaybackRemapResult {
  const idx = resolveSegmentIdxContainingPlayhead(input.segments, input.playheadSec);
  if (idx < 0) {
    return {
      idx: -1,
      autoStoppedIdx: null,
      pausedAnchor: null,
      session: null,
    };
  }
  const t = Number.isFinite(input.playheadSec) ? input.playheadSec : 0;
  if (input.hadAutoStopped) {
    return {
      idx,
      autoStoppedIdx: idx,
      pausedAnchor: null,
      session: { kind: "segment", idx },
    };
  }
  if (input.hadPausedAnchor) {
    return {
      idx,
      autoStoppedIdx: null,
      pausedAnchor: { idx, timeSec: t },
      session: { kind: "segment", idx },
    };
  }
  return {
    idx,
    autoStoppedIdx: null,
    pausedAnchor: null,
    session: { kind: "segment", idx },
  };
}
