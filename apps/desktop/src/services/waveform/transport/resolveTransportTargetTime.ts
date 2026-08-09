import {
  TRANSPORT_DISPLAY_LAG_RESUME_CAP_SEC,
  TRANSPORT_RAW_DISPLAY_RESUME_EPSILON_SEC,
  type SegmentPlayMode,
  type SegmentPlayFromResolution,
} from "./transportTypes";

export type ResolveSegmentPlayFromInput = {
  segment: { start_sec: number; end_sec: number };
  /** Explicit play-from (double-click / pointer). Clamped into segment. */
  fromSec?: number;
  /** Display / decision clock (`getDisplayPlayheadTimeSec`). */
  displaySec: number;
  /**
   * Authority latch (`getAuthorityPlayheadTimeSec` / TimeUpdate).
   * Resume-skip gate only — never the sole pause freeze source.
   */
  authoritySec?: number;
  /** Max |authority − display| to allow resume without seek. */
  resumeEpsilonSec?: number;
  /** Max |authority − display| to still resume (avoid yanking either clock). */
  displayLagResumeCapSec?: number;
};

/**
 * Play-from priority (Transport Authority):
 * 1. explicit `fromSec` (clamped into segment) — but never seek *backward* to a
 *    lagging pause anchor when authority already leads within the lag cap
 * 2. authority≈display and authority inside segment → resume skip seek
 * 3. either clock slightly behind the other (both in segment) → resume skip
 *    (never yank the needle toward the lagging clock; high zoom makes this loud)
 * 4. display inside segment → seek to display
 * 5. display past segment end → play from display (gap after; do not snap to start)
 * 6. display before segment start → seek to segment start
 */
export function resolveSegmentPlayFrom(
  input: ResolveSegmentPlayFromInput,
): SegmentPlayFromResolution {
  const start = Math.min(input.segment.start_sec, input.segment.end_sec);
  const end = Math.max(input.segment.start_sec, input.segment.end_sec);
  const epsilon = input.resumeEpsilonSec ?? TRANSPORT_RAW_DISPLAY_RESUME_EPSILON_SEC;
  const lagCap = input.displayLagResumeCapSec ?? TRANSPORT_DISPLAY_LAG_RESUME_CAP_SEC;

  const display = Number.isFinite(input.displaySec) ? input.displaySec : 0;
  const authority = input.authoritySec;
  const authorityInside =
    authority != null && Number.isFinite(authority) && authority >= start && authority < end;
  const displayInside = display >= start && display < end;

  if (input.fromSec != null && Number.isFinite(input.fromSec)) {
    const clamped = Math.max(start, Math.min(end, input.fromSec));
    // Pause anchor captured from lagging TimeUpdate while native pause already
    // froze media at display high-water — seeking back would rewind the needle.
    if (
      authorityInside &&
      clamped <= (authority) &&
      (authority) - clamped <= lagCap
    ) {
      return { kind: "resumeSkipSeek" };
    }
    return {
      kind: "seek",
      timeSec: clamped,
    };
  }

  if (
    authorityInside &&
    Math.abs((authority) - display) <= epsilon
  ) {
    return { kind: "resumeSkipSeek" };
  }

  // Pause-resume: either clock may lag the other by >ε. Seeking to the lagging
  // side pulls the playhead backward (worse at high zoom). Keep media position
  // when the gap is small. Large display≪authority gaps are intentional (select→
  // segment start while authority stale) and still honor display below.
  if (
    authorityInside &&
    displayInside &&
    Math.abs((authority) - display) <= lagCap
  ) {
    return { kind: "resumeSkipSeek" };
  }

  if (displayInside) {
    return { kind: "seek", timeSec: display };
  }

  // Past segment end (including finished segment / gap after): continue from playhead.
  if (display >= end) {
    if (
      authority != null &&
      Number.isFinite(authority) &&
      Math.abs(authority - display) <= epsilon
    ) {
      return { kind: "resumeSkipSeek" };
    }
    return { kind: "seek", timeSec: display };
  }

  // Before segment start (e.g. selected next segment while playhead still earlier).
  return { kind: "seek", timeSec: start };
}

/**
 * Intent-aware segment play resolver.
 *
 * Explicit scoped controls own their target segment. When the visible playhead
 * is outside it, restart from the segment head instead of inheriting the
 * resume/continue resolver's deliberate gap-after behavior.
 */
export function resolveSegmentPlayFromForMode(
  input: ResolveSegmentPlayFromInput,
  mode: SegmentPlayMode = "resumeOrContinue",
): SegmentPlayFromResolution {
  if (mode !== "scoped" || (input.fromSec != null && Number.isFinite(input.fromSec))) {
    return resolveSegmentPlayFrom(input);
  }
  const start = Math.min(input.segment.start_sec, input.segment.end_sec);
  const end = Math.max(input.segment.start_sec, input.segment.end_sec);
  const displayInside = input.displaySec >= start && input.displaySec < end;
  return resolveSegmentPlayFrom(displayInside ? input : { ...input, fromSec: start });
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
