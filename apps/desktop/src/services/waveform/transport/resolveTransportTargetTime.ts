import { resolveSegmentPlaybackStartSec } from "../../../utils/formatMediaTime";
import {
  TRANSPORT_RAW_DISPLAY_RESUME_EPSILON_SEC,
  type SegmentPlayFromResolution,
} from "./transportTypes";

export type ResolveSegmentPlayFromInput = {
  segment: { start_sec: number; end_sec: number };
  /** Explicit play-from (double-click / pointer). Clamped into segment. */
  fromSec?: number;
  /** Display / decision clock (`getDisplayPlayheadTimeSec`). */
  displaySec: number;
  /** Raw `ws.getCurrentTime()` — only for resume-skip gate. */
  rawMediaSec?: number;
  /** Max |raw − display| to allow resume without seek. */
  resumeEpsilonSec?: number;
};

/**
 * Play-from priority (Transport Authority):
 * 1. explicit `fromSec` (clamped)
 * 2. display inside segment → seek to display
 * 3. raw≈display and raw inside segment → resume skip seek
 * 4. else `resolveSegmentPlaybackStartSec(display, seg)` (usually segment start)
 */
export function resolveSegmentPlayFrom(
  input: ResolveSegmentPlayFromInput,
): SegmentPlayFromResolution {
  const start = Math.min(input.segment.start_sec, input.segment.end_sec);
  const end = Math.max(input.segment.start_sec, input.segment.end_sec);
  const epsilon = input.resumeEpsilonSec ?? TRANSPORT_RAW_DISPLAY_RESUME_EPSILON_SEC;

  if (input.fromSec != null && Number.isFinite(input.fromSec)) {
    return {
      kind: "seek",
      timeSec: Math.max(start, Math.min(end, input.fromSec)),
    };
  }

  const display = Number.isFinite(input.displaySec) ? input.displaySec : 0;
  const raw = input.rawMediaSec;
  const rawInside =
    raw != null && Number.isFinite(raw) && raw >= start && raw < end;
  const displayInside = display >= start && display < end;

  if (
    rawInside &&
    Math.abs((raw as number) - display) <= epsilon
  ) {
    return { kind: "resumeSkipSeek" };
  }

  if (displayInside) {
    return { kind: "seek", timeSec: display };
  }

  return {
    kind: "seek",
    timeSec: resolveSegmentPlaybackStartSec(display, input.segment),
  };
}

export type ResolveSeekTargetInput = {
  timeSec: number;
  durationSec: number;
};

/** Clamp seek target into [0, duration] (or ≥0 when duration unknown). */
export function resolveSeekTargetTime(input: ResolveSeekTargetInput): number {
  const t = Number.isFinite(input.timeSec) ? input.timeSec : 0;
  const d = input.durationSec;
  if (!Number.isFinite(d) || d <= 0) return Math.max(0, t);
  return Math.max(0, Math.min(d, t));
}

export type ResolveSelectTransportSeekInput = {
  seekPolicy: "segmentStart" | "none" | "pointerTime";
  segment: { start_sec: number; end_sec: number };
  pointerTimeSec?: number;
};

/** Resolve media time for `selectSegmentTransport` (SC2 must not decide this). */
export function resolveSelectTransportSeekTime(
  input: ResolveSelectTransportSeekInput,
): number | null {
  if (input.seekPolicy === "none") return null;
  const start = Math.min(input.segment.start_sec, input.segment.end_sec);
  const end = Math.max(input.segment.start_sec, input.segment.end_sec);
  if (input.seekPolicy === "segmentStart") return start;
  if (input.seekPolicy === "pointerTime") {
    const p = input.pointerTimeSec;
    if (p == null || !Number.isFinite(p)) return start;
    return Math.max(start, Math.min(end, p));
  }
  return null;
}
