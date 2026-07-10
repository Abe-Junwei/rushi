import type { TransportIntent } from "./transportTypes";
import {
  resolveSeekTargetTime,
  resolveSelectTransportSeekTime,
  resolveSegmentPlayFrom,
  type ResolveSegmentPlayFromInput,
} from "./resolveTransportTargetTime";

export type TransportMediaSink = {
  setTime: (timeSec: number) => void;
  play: () => Promise<void> | void;
  pause: () => void;
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
  applySeek: (timeSec: number, opts?: { suppressFollow?: boolean }) => void;
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
      deps.applySeek(clamped, { suppressFollow: intent.suppressFollow });
      return;
    }
    case "pause": {
      if (deps.media.isPlaying()) deps.media.pause();
      return;
    }
    case "playSegment": {
      const input = deps.resolvePlayFromInput(intent.idx, intent.fromSec);
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
        deps.applySeek(seekTimeSec, { suppressFollow: true });
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
export function applyPeaksOrderedSeek(args: {
  timeSec: number;
  durationSec: number;
  syncDisplayPlayheadAfterSeek: (t: number) => void;
  setTime: (t: number) => void;
  commitSeekUi?: (t: number) => void;
  suppressFollow?: boolean;
  suppressPlaybackFollow?: () => void;
}): number {
  const clamped = resolveSeekTargetTime({
    timeSec: args.timeSec,
    durationSec: args.durationSec,
  });
  if (args.suppressFollow) args.suppressPlaybackFollow?.();
  args.syncDisplayPlayheadAfterSeek(clamped);
  args.setTime(clamped);
  args.commitSeekUi?.(clamped);
  return clamped;
}

export type { TransportSource } from "./transportTypes";
