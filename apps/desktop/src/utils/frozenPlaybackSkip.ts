/**
 * Global-play skip windows for frozen segments (Descript Ignore / Trint Strike analogue).
 * Does not mute — seek-jumps to window end while playing.
 */

export type FrozenTimeWindow = { startSec: number; endSec: number };

const SKIP_EPSILON_SEC = 0.02;

export function isSegmentFrozen(seg: { frozen?: boolean | null } | null | undefined): boolean {
  return Boolean(seg?.frozen);
}

/** Merge adjacent/overlapping frozen ranges (by time). */
export function coalesceFrozenRanges(
  segments: readonly { start_sec: number; end_sec: number; frozen?: boolean | null }[],
): FrozenTimeWindow[] {
  const ranges: FrozenTimeWindow[] = [];
  for (const s of segments) {
    if (!isSegmentFrozen(s)) continue;
    const startSec = Math.min(s.start_sec, s.end_sec);
    const endSec = Math.max(s.start_sec, s.end_sec);
    if (!(endSec > startSec)) continue;
    const last = ranges[ranges.length - 1];
    if (last && startSec <= last.endSec + SKIP_EPSILON_SEC) {
      last.endSec = Math.max(last.endSec, endSec);
    } else {
      ranges.push({ startSec, endSec });
    }
  }
  return ranges;
}

/**
 * If playhead is inside a frozen window (not at/after end−ε), return seek target = window end.
 * Returns null when no skip needed.
 */
export function resolveFrozenPlaybackSkipTargetSec(
  playheadSec: number,
  segments: readonly { start_sec: number; end_sec: number; frozen?: boolean | null }[],
): number | null {
  if (!Number.isFinite(playheadSec)) return null;
  const windows = coalesceFrozenRanges(segments);
  for (const w of windows) {
    if (playheadSec >= w.startSec && playheadSec < w.endSec - SKIP_EPSILON_SEC) {
      return w.endSec;
    }
  }
  return null;
}

/** Delivery exports exclude frozen rows (and their annotations); archive/save keep them. */
export function segmentsForDeliveryExport<T extends { frozen?: boolean | null }>(
  segments: readonly T[],
): T[] {
  return segments.filter((s) => !isSegmentFrozen(s));
}
