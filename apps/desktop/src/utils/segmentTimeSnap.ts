import { roundSec3 } from "./boundsSignature";

/** Pointer proximity (px) mapped to time threshold via timeline width — matches edge hit scale. */
const WAVEFORM_SEGMENT_SNAP_THRESHOLD_PX = 8;

export function resolveSnapThresholdSec(
  timelineWidthPx: number,
  durationSec: number,
  thresholdPx = WAVEFORM_SEGMENT_SNAP_THRESHOLD_PX,
): number {
  if (!(durationSec > 0) || !(timelineWidthPx > 0)) return 0.1;
  return (thresholdPx / timelineWidthPx) * durationSec;
}

/** Boundaries to snap to: track edges, playhead, and other segments' start/end. */
export function collectSegmentSnapTargets(input: {
  segments: ReadonlyArray<{ start_sec: number; end_sec: number }>;
  durationSec: number;
  playheadSec?: number;
  /** Omit the segment being dragged so its own edges are not snap magnets. */
  excludeSegmentIndex?: number;
}): number[] {
  const targets: number[] = [];
  if (input.durationSec > 0) {
    targets.push(0, input.durationSec);
  }
  const ph = input.playheadSec;
  if (ph != null && Number.isFinite(ph) && ph >= 0) {
    targets.push(ph);
  }
  for (let i = 0; i < input.segments.length; i += 1) {
    if (i === input.excludeSegmentIndex) continue;
    const s = input.segments[i];
    if (!s) continue;
    targets.push(Math.min(s.start_sec, s.end_sec), Math.max(s.start_sec, s.end_sec));
  }
  const uniq = new Set<number>();
  for (const t of targets) {
    if (Number.isFinite(t)) uniq.add(roundSec3(t));
  }
  return [...uniq].sort((a, b) => a - b);
}

/** Snap a single time to the nearest target within thresholdSec (unchanged if none close enough). */
export function snapTimeSec(
  timeSec: number,
  targets: readonly number[],
  thresholdSec: number,
): number {
  if (!(thresholdSec > 0) || targets.length === 0) return timeSec;
  let best = timeSec;
  let bestDist = thresholdSec;
  for (const t of targets) {
    const d = Math.abs(t - timeSec);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return roundSec3(best);
}

export function snapSegmentRange(
  rawLo: number,
  rawHi: number,
  targets: readonly number[],
  thresholdSec: number,
): { startSec: number; endSec: number } {
  const lo = Math.min(rawLo, rawHi);
  const hi = Math.max(rawLo, rawHi);
  return {
    startSec: snapTimeSec(lo, targets, thresholdSec),
    endSec: snapTimeSec(hi, targets, thresholdSec),
  };
}

export type SnapDragMode = "move" | "resize-start" | "resize-end";

/** Apply snap to drag bounds; move mode preserves span when an edge snaps. */
export function applySnapToDragBounds(
  bounds: { startSec: number; endSec: number },
  mode: SnapDragMode,
  targets: readonly number[],
  thresholdSec: number,
  enabled: boolean,
): { startSec: number; endSec: number } {
  if (!enabled) return bounds;
  if (mode === "move") {
    const snappedStart = snapTimeSec(bounds.startSec, targets, thresholdSec);
    const delta = snappedStart - bounds.startSec;
    if (Math.abs(delta) < 1e-9) return bounds;
    return {
      startSec: roundSec3(snappedStart),
      endSec: roundSec3(bounds.endSec + delta),
    };
  }
  if (mode === "resize-start") {
    return { ...bounds, startSec: snapTimeSec(bounds.startSec, targets, thresholdSec) };
  }
  return { ...bounds, endSec: snapTimeSec(bounds.endSec, targets, thresholdSec) };
}
