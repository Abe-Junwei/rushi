import { useCallback, useEffect, useRef } from "react";
import type WaveSurfer from "wavesurfer.js";
import {
  armSegmentPlaybackSession,
  isActiveSegmentPlaybackBound,
  segmentPlaybackReachedEnd,
  type ActiveSegmentPlaybackBound,
} from "../utils/segmentPlaybackBound";
import { subscribeTranscriptSelectionProjection } from "../components/editor/core/transcriptProjection";
import { subscribePlaybackFrame } from "../utils/tierScrollFrameCoordinator";
import { noteMediaPaused } from "../utils/mediaPlayGate";
import {
  resolveMediaPlaybackHost,
  type PlaybackTransport,
} from "../services/waveform/transport";
import {
  nextSegmentPlaybackPhase,
  type SegmentPlaybackPhase,
} from "../services/waveform/segmentPlaybackPhase";

export type WaveformSegmentPlaybackBoundSyncArgs = {
  wsRef: React.MutableRefObject<WaveSurfer | null>;
  transportRef?: React.MutableRefObject<PlaybackTransport | null>;
  /** Bumps when native transport is assigned/cleared so event subscriptions re-bind. */
  transportEpoch?: number;
  requireTransport?: boolean;
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
    transportRef,
    transportEpoch = 0,
    requireTransport,
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
  } = args;

  const phaseRef = useRef<SegmentPlaybackPhase>("idle");

  /**
   * Stop at segment end. Driven by native TimeUpdate / playback-frame events.
   */
  const enforceSegmentPlaybackBound = useCallback(
    (playheadTimeSec?: number) => {
      if (segmentBoundStopInFlightRef.current) return;
      const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
        requireTransport,
      });
      if (!host || !isReady) return;
      const bound = segmentPlaybackBoundRef.current;
      if (!isActiveSegmentPlaybackBound(bound, playGenerationRef.current)) return;
      if (!host.isPlaying()) return;
      const currentSec =
        typeof playheadTimeSec === "number" && Number.isFinite(playheadTimeSec)
          ? playheadTimeSec
          : resolvePlayheadSec();
      if (bound.armed && currentSec < bound.endSec - 0.1) return;
      if (!armSegmentPlaybackSession(bound, currentSec)) return;
      if (!segmentPlaybackReachedEnd(currentSec, bound.endSec)) return;

      phaseRef.current = nextSegmentPlaybackPhase(phaseRef.current, "boundHit");
      segmentBoundStopInFlightRef.current = true;
      const loop = segmentLoopPlaybackRef.current;
      const stopGen = ++playGenerationRef.current;
      const gateHost = host.gateHost;

      // Native Channel pause is async IPC — no WK MediaElement nest risk.
      // Keep stop-in-flight until pause settles so TimeUpdate cannot re-arm.
      void Promise.resolve(host.pause())
        .catch(() => undefined)
        .finally(() => {
          segmentBoundStopInFlightRef.current = false;
          noteMediaPaused(gateHost);
          const live = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
            requireTransport,
          });
          if (!live || live.gateHost !== gateHost) return;
          if (stopGen !== playGenerationRef.current) return;

          if (loop) {
            phaseRef.current = nextSegmentPlaybackPhase(phaseRef.current, "loopRestart");
          } else {
            autoStoppedSegmentIdxRef.current =
              resolveNaturalEndReplayIdx?.() ?? resolveEffectiveSelectedIdx();
            segmentPlaybackBoundRef.current = null;
            setIsSelectedSegmentPlaying(false);
            phaseRef.current = nextSegmentPlaybackPhase(phaseRef.current, "reset");
          }
        });
    },
    [
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
      requireTransport,
      transportRef,
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
      const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
        requireTransport,
      });
      if (!host || !isReady) {
        if (isSelectedSegmentPlayingRef.current) setIsSelectedSegmentPlaying(false);
        return;
      }
      if (!host.isPlaying()) {
        if (segmentPlaybackBoundRef.current) segmentPlaybackBoundRef.current = null;
        // Keep globalPlayGenRef across the arm-before-play window (beginGlobalPlayback
        // then React re-render before ws.play). Cleared by segment arm / clear/cancel.
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
          // Same arm rule as runPlaySegmentResolved — avoid unarmed overshoot miss.
          const clearOfEnd = t < range.end - 0.05;
          segmentPlaybackBoundRef.current = {
            startSec: range.start,
            endSec: range.end,
            generation: gen,
            armed: clearOfEnd,
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
        host.isPlaying()
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
      requireTransport,
      transportRef,
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
    const transport = transportRef?.current;
    if (transport?.kind === "native") {
      if (!isReady) return;
      const onAudio = () => {
        enforceSegmentPlaybackBound();
        syncSelectedSegmentPlayingUi();
      };
      return transport.subscribe({
        onTimeUpdate: onAudio,
        onPlay: () => {
          phaseRef.current = nextSegmentPlaybackPhase(phaseRef.current, "play");
          onAudio();
        },
        onPause: () => {
          phaseRef.current = nextSegmentPlaybackPhase(phaseRef.current, "pause");
          onAudio();
        },
        onFinish: onAudio,
      });
    }
    if (requireTransport) return;
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    const onAudio = () => {
      enforceSegmentPlaybackBound();
      syncSelectedSegmentPlayingUi();
    };
    const unsubAudio = ws.on("audioprocess", onAudio);
    return () => {
      unsubAudio();
    };
  }, [enforceSegmentPlaybackBound, isReady, requireTransport, syncSelectedSegmentPlayingUi, transportEpoch, transportRef, wsRef]);

  useEffect(() => {
    const transport = transportRef?.current;
    if (transport?.kind === "native") {
      if (!isReady) return;
      const onPlayPause = () => {
        syncSelectedSegmentPlayingUi();
      };
      const unsub = transport.subscribe({
        onPlay: onPlayPause,
        onPause: onPlayPause,
        onFinish: onPlayPause,
      });
      syncSelectedSegmentPlayingUi();
      return unsub;
    }
    if (requireTransport) return;
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
  }, [isReady, requireTransport, syncSelectedSegmentPlayingUi, transportEpoch, transportRef, wsRef]);

  return { enforceSegmentPlaybackBound, syncSelectedSegmentPlayingUi };
}
