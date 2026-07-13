import { useEffect, type MutableRefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import {
  resolveMediaPlaybackHost,
  type PlaybackTransport,
} from "../services/waveform/transport";

/**
 * When segment loop is on, restart from segment start after pause/finish near end.
 *
 * Must pass an explicit fromSec=start — plain playSelectedSegment uses
 * resolveSegmentPlayFrom which treats display-at-end as "gap after" and continues
 * unbounded past the segment (loop appears broken).
 */
export function useWaveformSegmentLoopReplay(args: {
  wsRef: MutableRefObject<WaveSurfer | null>;
  transportRef?: MutableRefObject<PlaybackTransport | null>;
  transportEpoch?: number;
  requireTransport?: boolean;
  isReady: boolean;
  segmentLoopPlayback: boolean;
  segmentLoopPlaybackRef: MutableRefObject<boolean>;
  resolvePlayheadSec: () => number;
  resolveSelectedPlaybackRange: () => { start: number; end: number } | null;
  resolveEffectiveSelectedIdx: () => number;
  playSegmentAtIndex: (
    idx: number,
    options?: { fromSec?: number; loop?: boolean },
  ) => Promise<void>;
}): void {
  const {
    wsRef,
    transportRef,
    transportEpoch = 0,
    requireTransport,
    isReady,
    segmentLoopPlayback,
    segmentLoopPlaybackRef,
    resolvePlayheadSec,
    resolveSelectedPlaybackRange,
    resolveEffectiveSelectedIdx,
    playSegmentAtIndex,
  } = args;

  useEffect(() => {
    const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
      requireTransport,
    });
    if (!host || !isReady || !segmentLoopPlayback) return;
    let replayScheduled = false;

    const maybeReplay = () => {
      if (replayScheduled || !segmentLoopPlaybackRef.current) return;
      const range = resolveSelectedPlaybackRange();
      if (!range) return;
      const t = resolvePlayheadSec();
      // Only when playhead is in-range and near the end (avoid seek-outside false triggers).
      if (t < range.start || t + 0.04 < range.end) return;
      const idx = resolveEffectiveSelectedIdx();
      if (idx < 0) return;
      replayScheduled = true;
      requestAnimationFrame(() => {
        replayScheduled = false;
        if (!segmentLoopPlaybackRef.current) return;
        const live = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
          requireTransport,
        });
        if (live?.isPlaying()) return;
        void playSegmentAtIndex(idx, { fromSec: range.start, loop: true });
      });
    };

    const transport = transportRef?.current;
    if (transport?.kind === "native") {
      return transport.subscribe({
        onPause: maybeReplay,
        onFinish: maybeReplay,
      });
    }

    if (requireTransport) return;

    const ws = wsRef.current;
    if (!ws) return;
    const unsubPause = ws.on("pause", maybeReplay);
    const unsubFinish = ws.on("finish", maybeReplay);
    return () => {
      unsubPause();
      unsubFinish();
    };
  }, [
    isReady,
    playSegmentAtIndex,
    requireTransport,
    resolveEffectiveSelectedIdx,
    resolvePlayheadSec,
    resolveSelectedPlaybackRange,
    segmentLoopPlayback,
    segmentLoopPlaybackRef,
    transportEpoch,
    transportRef,
    wsRef,
  ]);
}
