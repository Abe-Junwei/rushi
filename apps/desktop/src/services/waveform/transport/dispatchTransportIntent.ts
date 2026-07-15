import type { TransportIntent } from "./transportTypes";
import {
  resolveSeekTargetTime,
  resolveSelectTransportSeekTime,
  resolveSegmentPlayFrom,
  type ResolveSegmentPlayFromInput,
} from "./resolveTransportTargetTime";

export type TransportMediaSink = {
  setTime: (timeSec: number) => void | Promise<void>;
  play: () => Promise<void> | void;
  pause: () => void | Promise<void>;
  isPlaying: () => boolean;
};

export type TransportDispatchDeps = {
  isReady: boolean;
  getDurationSec: () => number;
  syncDisplayPlayheadAfterSeek: (timeSec: number) => void;
  commitSeekUi?: (timeSec: number) => void;
  suppressPlaybackFollow?: () => void;
  media: TransportMediaSink;
  /** Apply Peaks-ordered seek (sync display → setTime → commit). */
  applySeek: (timeSec: number, opts?: { suppressFollow?: boolean }) => void | Promise<void>;
  /**
   * Segment play with play-from already resolved by {@link resolveSegmentPlayFrom}.
   * Hook owns bound arm / rate / generation.
   */
  runPlaySegment: (args: {
    idx: number;
    playFrom: ReturnType<typeof resolveSegmentPlayFrom>;
    loop?: boolean;
  }) => Promise<void>;
  runToggleSegmentPlay: () => Promise<void>;
  resolvePlayFromInput: (idx: number, fromSec?: number) => ResolveSegmentPlayFromInput | null;
  /**
   * Optional sticky resume (natural segment-end → start; mid pause → freeze).
   * Only consulted for `playSegment` — never for select seek.
   */
  resolveSegmentResumeFromSec?: (idx: number, fromSec?: number) => number | undefined;
};

/**
 * Single Transport Authority entry. Side-effect order for seek:
 * suppress? → syncDisplay → setTime → commitSeekUi (via applySeek).
 *
 * `selectSegmentTransport` resolves seek time only (SC1/SC2 chrome stay in selection).
 */
export async function dispatchTransportIntent(
  intent: TransportIntent,
  deps: TransportDispatchDeps,
): Promise<void> {
  if (!deps.isReady) return;

  switch (intent.kind) {
    case "seek": {
      const clamped = resolveSeekTargetTime({
        timeSec: intent.timeSec,
        durationSec: deps.getDurationSec(),
      });
      await deps.applySeek(clamped, { suppressFollow: intent.suppressFollow });
      return;
    }
    case "pause": {
      if (deps.media.isPlaying()) await deps.media.pause();
      return;
    }
    case "playSegment": {
      // Space sticky natural-end must inject segment start here. Plain
      // resolvePlayFromInput + display-at-end continues unbounded past the segment.
      const resumeFromSec =
        deps.resolveSegmentResumeFromSec?.(intent.idx, intent.fromSec) ?? intent.fromSec;
      const input = deps.resolvePlayFromInput(intent.idx, resumeFromSec);
      if (!input) return;
      const playFrom = resolveSegmentPlayFrom(input);
      await deps.runPlaySegment({
        idx: intent.idx,
        playFrom,
        loop: intent.loop,
      });
      return;
    }
    case "toggleSegmentPlay": {
      await deps.runToggleSegmentPlay();
      return;
    }
    case "selectSegmentTransport": {
      const input = deps.resolvePlayFromInput(intent.idx);
      if (!input) return;
      const seekTimeSec = resolveSelectTransportSeekTime({
        seekPolicy: intent.seekPolicy,
        segment: input.segment,
        pointerTimeSec: intent.pointerTimeSec,
      });
      if (seekTimeSec != null) {
        await deps.applySeek(seekTimeSec, { suppressFollow: true });
      }
      return;
    }
    default: {
      const _exhaustive: never = intent;
      void _exhaustive;
    }
  }
}

/** Convenience: Peaks-ordered seek without full intent object. */
export async function applyPeaksOrderedSeek(args: {
  timeSec: number;
  durationSec: number;
  /** VisualSeeking state machine: block engine polls until seeked ACK. */
  beginVisualSeek: (t: number, opts?: { deferViewportFrame?: boolean }) => void;
  /** Same-stack release after {@link args.setTime} resolves (native seeked). */
  endVisualSeek?: (t: number) => void;
  /** Land follow scroll/pin on the seek target (playing seek anti-thrash). */
  snapPlaybackViewportAfterSeek?: (t: number) => void;
  setTime: (t: number) => void | Promise<void>;
  commitSeekUi?: (t: number) => void;
  suppressFollow?: boolean;
  suppressPlaybackFollow?: () => void;
  /**
   * Playing edge listen-jump: seek playhead only — do not force-anchor tier scroll.
   * (Snap fights page-drive mid-band; user stays on current viewport page.)
   */
  skipViewportSnap?: boolean;
}): Promise<number> {
  const clamped = resolveSeekTargetTime({
    timeSec: args.timeSec,
    durationSec: args.durationSec,
  });
  if (args.suppressFollow) args.suppressPlaybackFollow?.();
  const willSnap = Boolean(args.snapPlaybackViewportAfterSeek) && !args.skipViewportSnap;
  args.beginVisualSeek(clamped, willSnap ? { deferViewportFrame: true } : undefined);
  if (willSnap) {
    args.snapPlaybackViewportAfterSeek?.(clamped);
  }
  try {
    await args.setTime(clamped);
    args.endVisualSeek?.(clamped);
    args.commitSeekUi?.(clamped);
  } catch (err) {
    // Always release VisualSeeking — otherwise a rejected/timed-out seek leaves
    // the UI pinned until the 2s zombie fallback.
    args.endVisualSeek?.(clamped);
    throw err;
  }
  return clamped;
}

export type { TransportSource } from "./transportTypes";
