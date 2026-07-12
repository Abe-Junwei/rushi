import { useCallback, useEffect } from "react";
import type WaveSurfer from "wavesurfer.js";
import {
  armSegmentPlaybackSession,
  isActiveSegmentPlaybackBound,
  segmentPlaybackReachedEnd,
  type ActiveSegmentPlaybackBound,
} from "../utils/segmentPlaybackBound";
import { subscribeTranscriptSelectionProjection } from "../components/editor/core/transcriptProjection";
import { subscribePlaybackFrame } from "../utils/tierScrollFrameCoordinator";
import { atomicWaveformSegmentSeek } from "../services/waveform/waveformSegmentPlaybackSeek";

export type WaveformSegmentPlaybackBoundSyncArgs = {
  wsRef: React.MutableRefObject<WaveSurfer | null>;
  isReady: boolean;
  playGenerationRef: React.MutableRefObject<number>;
  segmentPlaybackBoundRef: React.MutableRefObject<ActiveSegmentPlaybackBound | null>;
  segmentBoundStopInFlightRef: React.MutableRefObject<boolean>;
  playStartInFlightGenerationRef: React.MutableRefObject<number | null>;
  unboundedSelectedPlayGenRef: React.MutableRefObject<number | null>;
  /** Global continuous play generation — must not auto-arm segment end-bound. */
  globalPlayGenRef: React.MutableRefObject<number | null>;
  segmentLoopPlaybackRef: React.MutableRefObject<boolean>;
  isSelectedSegmentPlayingRef: React.MutableRefObject<boolean>;
  autoStoppedSegmentIdxRef: React.MutableRefObject<number | null>;
  setIsSelectedSegmentPlaying: (playing: boolean) => void;
  resolvePlayheadSec: () => number;
  resolveSelectedPlaybackRange: () => { start: number; end: number } | null;
  resolveEffectiveSelectedIdx: () => number;
  /** Prefer sticky session idx over selection when marking natural-end replay. */
  resolveNaturalEndReplayIdx?: () => number;
  layoutDurationSecRef?: React.MutableRefObject<number>;
  syncDisplayPlayheadAfterSeekRef?: React.MutableRefObject<((timeSec: number) => void) | null>;
  commitSeekUi?: (timeSec: number) => void;
};

/**
 * Segment end-bound enforcement + Stop-chrome sync with live media / selection.
 * Owns playback-frame, audioprocess, and WaveSurfer play/pause/finish subscriptions.
 */
export function useWaveformSegmentPlaybackBoundSync(
  args: WaveformSegmentPlaybackBoundSyncArgs,
): {
  enforceSegmentPlaybackBound: (playheadTimeSec?: number) => void;
  syncSelectedSegmentPlayingUi: (playheadTimeSec?: number) => void;
} {
  const {
    wsRef,
    isReady,
    playGenerationRef,
    segmentPlaybackBoundRef,
    segmentBoundStopInFlightRef,
    playStartInFlightGenerationRef,
    unboundedSelectedPlayGenRef,
    globalPlayGenRef,
    segmentLoopPlaybackRef,
    isSelectedSegmentPlayingRef,
    autoStoppedSegmentIdxRef,
    setIsSelectedSegmentPlaying,
    resolvePlayheadSec,
    resolveSelectedPlaybackRange,
    resolveEffectiveSelectedIdx,
    resolveNaturalEndReplayIdx,
    layoutDurationSecRef,
    syncDisplayPlayheadAfterSeekRef,
    commitSeekUi,
  } = args;

  const atomicMediaSeek = useCallback(
    (timeSec: number) => {
      const ws = wsRef.current;
      if (!ws) return;
      atomicWaveformSegmentSeek({
        ws,
        timeSec,
        layoutDurationSecRef,
        syncDisplayPlayheadAfterSeekRef,
        commitSeekUi,
      });
    },
    [commitSeekUi, layoutDurationSecRef, syncDisplayPlayheadAfterSeekRef, wsRef],
  );

  /**
   * Stop at segment end. Must run on Rushi playback frames (WS-2b silences WS
   * timer → audioprocess is sparse). Call before syncSelectedSegmentPlayingUi.
   */
  const enforceSegmentPlaybackBound = useCallback(
    (playheadTimeSec?: number) => {
      if (segmentBoundStopInFlightRef.current) return;
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      const bound = segmentPlaybackBoundRef.current;
      if (!isActiveSegmentPlaybackBound(bound, playGenerationRef.current)) return;
      if (!ws.isPlaying()) return;
      const currentSec =
        typeof playheadTimeSec === "number" && Number.isFinite(playheadTimeSec)
          ? playheadTimeSec
          : resolvePlayheadSec();
      if (bound.armed && currentSec < bound.endSec - 0.1) return;
      if (!armSegmentPlaybackSession(bound, currentSec)) return;
      if (!segmentPlaybackReachedEnd(currentSec, bound.endSec)) return;

      segmentBoundStopInFlightRef.current = true;
      const endSec = bound.endSec;
      const loop = segmentLoopPlaybackRef.current;
      const stopGen = ++playGenerationRef.current;

      queueMicrotask(() => {
        segmentBoundStopInFlightRef.current = false;
        const live = wsRef.current;
        if (!live || live !== ws) return;
        // User pause / new play bumped generation — do not move the playhead.
        if (stopGen !== playGenerationRef.current) return;

        live.pause();
        if (loop) {
          const clampedEnd = Math.min(endSec, live.getDuration());
          if (Number.isFinite(clampedEnd)) {
            atomicMediaSeek(clampedEnd);
          }
        } else {
          autoStoppedSegmentIdxRef.current =
            resolveNaturalEndReplayIdx?.() ?? resolveEffectiveSelectedIdx();
          segmentPlaybackBoundRef.current = null;
          setIsSelectedSegmentPlaying(false);
          // Freeze at segment end — never seek back to start on auto-stop.
          // The next selected-segment play is explicitly routed back to segment start.
          const clampedEnd = Math.max(0, Math.min(endSec, live.getDuration()));
          if (Number.isFinite(clampedEnd)) {
            atomicMediaSeek(clampedEnd);
          }
        }
      });
    },
    [
      atomicMediaSeek,
      autoStoppedSegmentIdxRef,
      isReady,
      playGenerationRef,
      resolveEffectiveSelectedIdx,
      resolveNaturalEndReplayIdx,
      resolvePlayheadSec,
      segmentBoundStopInFlightRef,
      segmentLoopPlaybackRef,
      segmentPlaybackBoundRef,
      setIsSelectedSegmentPlaying,
      wsRef,
    ],
  );

  /**
   * Keep overlay/toolbar play icon + segment end-bound in sync with live media
   * and the selected segment. Selecting while playing used to clear the bound and
   * leave the control stuck on "play".
   *
   * Do not clear an active bound that has already passed end — that race let
   * media continue as unbounded global play after WS-2b sparse audioprocess.
   */
  const syncSelectedSegmentPlayingUi = useCallback(
    (playheadTimeSec?: number) => {
      const ws = wsRef.current;
      if (!ws || !isReady) {
        if (isSelectedSegmentPlayingRef.current) setIsSelectedSegmentPlaying(false);
        return;
      }
      if (!ws.isPlaying()) {
        if (segmentPlaybackBoundRef.current) segmentPlaybackBoundRef.current = null;
        if (globalPlayGenRef.current != null) globalPlayGenRef.current = null;
        if (isSelectedSegmentPlayingRef.current) setIsSelectedSegmentPlaying(false);
        return;
      }
      // enforceSegmentPlaybackBound already scheduled end-stop on this tick — do not
      // re-arm a new bound (that bumps generation and cancels the pending pause).
      if (segmentBoundStopInFlightRef.current) return;
      const range = resolveSelectedPlaybackRange();
      if (!range) {
        if (segmentPlaybackBoundRef.current) segmentPlaybackBoundRef.current = null;
        if (isSelectedSegmentPlayingRef.current) setIsSelectedSegmentPlaying(false);
        return;
      }
      const t =
        typeof playheadTimeSec === "number" && Number.isFinite(playheadTimeSec)
          ? playheadTimeSec
          : resolvePlayheadSec();
      const inside = t >= range.start && t < range.end;
      if (inside) {
        // Global continuous play: never auto-scope to the selected segment end.
        if (globalPlayGenRef.current === playGenerationRef.current) {
          if (segmentPlaybackBoundRef.current) segmentPlaybackBoundRef.current = null;
          if (isSelectedSegmentPlayingRef.current) setIsSelectedSegmentPlaying(false);
          return;
        }
        const bound = segmentPlaybackBoundRef.current;
        const boundMatches =
          bound != null &&
          bound.startSec === range.start &&
          bound.endSec === range.end &&
          bound.generation === playGenerationRef.current;
        if (!boundMatches) {
          const inFlightGen = playStartInFlightGenerationRef.current;
          const gen = inFlightGen ?? ++playGenerationRef.current;
          segmentPlaybackBoundRef.current = {
            startSec: range.start,
            endSec: range.end,
            generation: gen,
            armed: false,
          };
        }
        if (!isSelectedSegmentPlayingRef.current) setIsSelectedSegmentPlaying(true);
        return;
      }
      const bound = segmentPlaybackBoundRef.current;
      if (
        isActiveSegmentPlaybackBound(bound, playGenerationRef.current) &&
        t >= bound.endSec
      ) {
        // Past scoped end — leave bound for enforceSegmentPlaybackBound.
        return;
      }
      if (segmentPlaybackBoundRef.current) segmentPlaybackBoundRef.current = null;
      if (
        unboundedSelectedPlayGenRef.current === playGenerationRef.current &&
        ws.isPlaying()
      ) {
        if (!isSelectedSegmentPlayingRef.current) setIsSelectedSegmentPlaying(true);
        return;
      }
      unboundedSelectedPlayGenRef.current = null;
      if (isSelectedSegmentPlayingRef.current) setIsSelectedSegmentPlaying(false);
    },
    [
      globalPlayGenRef,
      isReady,
      isSelectedSegmentPlayingRef,
      playGenerationRef,
      playStartInFlightGenerationRef,
      resolvePlayheadSec,
      resolveSelectedPlaybackRange,
      segmentBoundStopInFlightRef,
      segmentPlaybackBoundRef,
      setIsSelectedSegmentPlaying,
      unboundedSelectedPlayGenRef,
      wsRef,
    ],
  );

  useEffect(() => {
    const syncAfterSelectionCommit = () => {
      queueMicrotask(() => {
        syncSelectedSegmentPlayingUi();
      });
    };
    const unsubProjection = subscribeTranscriptSelectionProjection(syncAfterSelectionCommit);
    return () => {
      unsubProjection();
    };
  }, [syncSelectedSegmentPlayingUi]);

  useEffect(() => {
    return subscribePlaybackFrame((timeSec) => {
      enforceSegmentPlaybackBound(timeSec);
      syncSelectedSegmentPlayingUi(timeSec);
    });
  }, [enforceSegmentPlaybackBound, syncSelectedSegmentPlayingUi]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    // Sparse backup while WS timer is silenced (WS-2b); primary path is playback frame.
    const onAudio = () => {
      enforceSegmentPlaybackBound();
      syncSelectedSegmentPlayingUi();
    };
    const unsubAudio = ws.on("audioprocess", onAudio);
    return () => {
      unsubAudio();
    };
  }, [enforceSegmentPlaybackBound, isReady, syncSelectedSegmentPlayingUi, wsRef]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    const onPlayPause = () => {
      syncSelectedSegmentPlayingUi();
    };
    const unsubPlay = ws.on("play", onPlayPause);
    const unsubPause = ws.on("pause", onPlayPause);
    const unsubFinish = ws.on("finish", onPlayPause);
    syncSelectedSegmentPlayingUi();
    return () => {
      unsubPlay();
      unsubPause();
      unsubFinish();
    };
  }, [isReady, syncSelectedSegmentPlayingUi, wsRef]);

  return { enforceSegmentPlaybackBound, syncSelectedSegmentPlayingUi };
}
