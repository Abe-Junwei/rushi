import { useCallback } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { SegmentDto } from "../tauri/projectApi";
import {
  isActiveSegmentPlaybackBound,
  type ActiveSegmentPlaybackBound,
} from "../utils/segmentPlaybackBound";
import {
  resolveMediaPlaybackHost,
  resolveSegmentPlayFrom,
  type PlaybackTransport,
  type SegmentPlayFromResolution,
} from "../services/waveform/transport";
import {
  applyWaveformGlobalPlaybackRate,
  atomicWaveformSegmentSeek,
} from "../services/waveform/waveformSegmentPlaybackSeek";
import {
  resolveSegmentResumeFromSec,
  resolveStickySegmentSpaceFromSec,
} from "../utils/segmentResumeFromSec";
import { endMediaPlay, enqueueMediaOp, tryBeginMediaPlay } from "../utils/mediaPlayGate";

export type PlaySegmentAtIndexOptions = {
  /** Tab 听打：切段后自动循环当前语段。 */
  loop?: boolean;
  /** 显式起播时刻（点击/双击）；钳在语段内。 */
  fromSec?: number;
};

export type WaveformSegmentPlayActionsArgs = {
  wsRef: React.MutableRefObject<WaveSurfer | null>;
  transportRef?: React.MutableRefObject<PlaybackTransport | null>;
  /** Native visual-only: block WaveSurfer media fallback until transport loads. */
  requireTransport?: boolean;
  isReady: boolean;
  latestSegmentsRef: React.MutableRefObject<SegmentDto[]>;
  getGlobalPlaybackRate: () => number;
  getRawMediaPlayheadTimeSec?: () => number;
  resolvePlayheadSec: () => number;
  resolveEffectiveSelectedIdx: () => number;
  resolveSelectedPlaybackRange: () => { start: number; end: number } | null;
  playGenerationRef: React.MutableRefObject<number>;
  segmentBoundStopInFlightRef: React.MutableRefObject<boolean>;
  playStartInFlightGenerationRef: React.MutableRefObject<number | null>;
  segmentPlaybackBoundRef: React.MutableRefObject<ActiveSegmentPlaybackBound | null>;
  unboundedSelectedPlayGenRef: React.MutableRefObject<number | null>;
  pausedResumeAnchorRef: React.MutableRefObject<{ idx: number; timeSec: number } | null>;
  autoStoppedSegmentIdxRef: React.MutableRefObject<number | null>;
  segmentLoopPlaybackRef: React.MutableRefObject<boolean>;
  clearSegmentPlaybackBound: () => void;
  cancelSegmentPlaybackBound: () => void;
  setSegmentLoopPlayback: (loop: boolean) => void;
  setIsSelectedSegmentPlaying: (playing: boolean) => void;
  /** Sticky Space session: arm scoped segment after successful segment play start. */
  armSegmentPlaybackSession: (idx: number) => void;
  layoutDurationSecRef?: React.MutableRefObject<number>;
  syncDisplayPlayheadAfterSeekRef?: React.MutableRefObject<((timeSec: number) => void) | null>;
  commitSeekUi?: (timeSec: number) => void;
};

/** Segment play / toggle / loop transport actions (Transport Authority play-from). */
export function useWaveformSegmentPlayActions(args: WaveformSegmentPlayActionsArgs) {
  const {
    wsRef,
    transportRef,
    requireTransport,
    isReady,
    latestSegmentsRef,
    getGlobalPlaybackRate,
    getRawMediaPlayheadTimeSec,
    resolvePlayheadSec,
    resolveEffectiveSelectedIdx,
    resolveSelectedPlaybackRange,
    playGenerationRef,
    segmentBoundStopInFlightRef,
    playStartInFlightGenerationRef,
    segmentPlaybackBoundRef,
    unboundedSelectedPlayGenRef,
    pausedResumeAnchorRef,
    autoStoppedSegmentIdxRef,
    segmentLoopPlaybackRef,
    clearSegmentPlaybackBound,
    cancelSegmentPlaybackBound,
    setSegmentLoopPlayback,
    setIsSelectedSegmentPlaying,
    armSegmentPlaybackSession,
    layoutDurationSecRef,
    syncDisplayPlayheadAfterSeekRef,
    commitSeekUi,
  } = args;

  const atomicMediaSeek = useCallback(
    async (timeSec: number) => {
      const ws = wsRef.current;
      if (!ws) return;
      await atomicWaveformSegmentSeek({
        ws,
        transport: transportRef?.current,
        requireTransport,
        timeSec,
        layoutDurationSecRef,
        syncDisplayPlayheadAfterSeekRef,
        commitSeekUi,
      });
    },
    [
      commitSeekUi,
      layoutDurationSecRef,
      requireTransport,
      syncDisplayPlayheadAfterSeekRef,
      transportRef,
      wsRef,
    ],
  );

  const applyGlobalPlaybackRate = useCallback(() => {
    applyWaveformGlobalPlaybackRate({
      ws: wsRef.current,
      transport: transportRef?.current,
      requireTransport,
      getGlobalPlaybackRate,
    });
  }, [getGlobalPlaybackRate, requireTransport, transportRef, wsRef]);

  /** Transport Authority: play with play-from already resolved by dispatcher. */
  const runPlaySegmentResolved = useCallback(
    async (playArgs: {
      idx: number;
      playFrom: SegmentPlayFromResolution;
      loop?: boolean;
    }) => {
      const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
        requireTransport,
      });
      if (!host || !isReady) return;
      const seg = latestSegmentsRef.current[playArgs.idx];
      if (!seg) return;
      // Hold the play gate across seek+play so Space/toggle cannot nest play().
      if (!tryBeginMediaPlay(host.gateHost)) return;
      try {
        const gen = ++playGenerationRef.current;
        playStartInFlightGenerationRef.current = gen;
        clearSegmentPlaybackBound();
        const range = {
          start: Math.min(seg.start_sec, seg.end_sec),
          end: Math.max(seg.start_sec, seg.end_sec),
        };
        applyGlobalPlaybackRate();
        if (playArgs.loop) {
          segmentLoopPlaybackRef.current = true;
          setSegmentLoopPlayback(true);
        }

        const wasPlaying = host.isPlaying();
        const seekToSec =
          playArgs.playFrom.kind === "seek" ? playArgs.playFrom.timeSec : null;
        let startAtSec = resolvePlayheadSec();
        if (seekToSec != null) {
          startAtSec = seekToSec;
        }

        // Already playing: seek only — never pause+play (nests RemoteAudioSession sync IPC).
        if (wasPlaying) {
          if (seekToSec != null) {
            await enqueueMediaOp(host.gateHost, "seek", async () => {
              await atomicMediaSeek(seekToSec);
            });
          }
        } else {
          if (seekToSec != null) {
            await enqueueMediaOp(host.gateHost, "seek", async () => {
              await atomicMediaSeek(seekToSec);
            });
          }
          try {
            await enqueueMediaOp(host.gateHost, "play", async () => {
              await host.play();
            });
          } catch {
            if (playStartInFlightGenerationRef.current === gen) {
              playStartInFlightGenerationRef.current = null;
            }
            if (gen !== playGenerationRef.current) return;
            clearSegmentPlaybackBound();
            return;
          }
        }

        if (gen !== playGenerationRef.current) {
          if (playStartInFlightGenerationRef.current === gen) {
            playStartInFlightGenerationRef.current = null;
          }
          if (host.isPlaying()) {
            await enqueueMediaOp(host.gateHost, "pause", () => {
              host.pause();
            });
          }
          return;
        }
        if (playStartInFlightGenerationRef.current === gen) {
          playStartInFlightGenerationRef.current = null;
        }
        if (!host.isPlaying()) return;

        // Only scope-stop at segment end when starting inside the selected segment.
        // Past end (gap after): free play from playhead — keep Stop chrome via unbounded gen.
        const insideAtStart = startAtSec >= range.start && startAtSec < range.end;
        if (insideAtStart) {
          unboundedSelectedPlayGenRef.current = null;
          // Mid-segment resume near the tail: arm immediately so a sparse first frame
          // past end still stops. Restart-from-start (natural-end replay): stay unarmed
          // until a frame is near start / inside — a stale end-time frame must not
          // immediately re-stop (display rewound, media still at end for one tick).
          const clearOfEnd = startAtSec < range.end - 0.05;
          const startingNearSegmentStart = startAtSec <= range.start + 0.05;
          segmentPlaybackBoundRef.current = {
            startSec: range.start,
            endSec: range.end,
            generation: gen,
            armed: clearOfEnd && !startingNearSegmentStart,
          };
        } else {
          segmentPlaybackBoundRef.current = null;
          unboundedSelectedPlayGenRef.current = gen;
        }
        setIsSelectedSegmentPlaying(true);
        armSegmentPlaybackSession(playArgs.idx);
      } finally {
        endMediaPlay(host.gateHost);
      }
    },
    [
      applyGlobalPlaybackRate,
      armSegmentPlaybackSession,
      atomicMediaSeek,
      clearSegmentPlaybackBound,
      isReady,
      latestSegmentsRef,
      playGenerationRef,
      playStartInFlightGenerationRef,
      resolvePlayheadSec,
      segmentPlaybackBoundRef,
      setIsSelectedSegmentPlaying,
      setSegmentLoopPlayback,
      segmentLoopPlaybackRef,
      requireTransport,
      transportRef,
      unboundedSelectedPlayGenRef,
      wsRef,
    ],
  );

  const playSegmentAtIndex = useCallback(
    async (idx: number, options?: PlaySegmentAtIndexOptions) => {
      const seg = latestSegmentsRef.current[idx];
      if (!seg) return;
      // Natural-end auto-stop marks this segment (autoStoppedIdx) so a single play
      // click restarts it from the segment start. A manual seek clears the marker,
      // so playback then resumes from the sought position instead of snapping back.
      const resumeFromSec = resolveSegmentResumeFromSec({
        segment: seg,
        targetIdx: idx,
        explicitFromSec: options?.fromSec,
        autoStoppedIdx: autoStoppedSegmentIdxRef.current,
        pausedAnchor: pausedResumeAnchorRef.current,
      });
      pausedResumeAnchorRef.current = null;
      autoStoppedSegmentIdxRef.current = null;
      const playFrom = resolveSegmentPlayFrom({
        segment: seg,
        fromSec: resumeFromSec,
        displaySec: resolvePlayheadSec(),
        rawMediaSec: getRawMediaPlayheadTimeSec?.(),
      });
      await runPlaySegmentResolved({
        idx,
        playFrom,
        loop: options?.loop,
      });
    },
    [
      autoStoppedSegmentIdxRef,
      getRawMediaPlayheadTimeSec,
      latestSegmentsRef,
      pausedResumeAnchorRef,
      resolvePlayheadSec,
      runPlaySegmentResolved,
    ],
  );

  const playSelectedSegment = useCallback(async () => {
    const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
      requireTransport,
    });
    const idx = resolveEffectiveSelectedIdx();
    const range = resolveSelectedPlaybackRange();
    if (!host || !isReady || idx < 0 || !range) return;
    await playSegmentAtIndex(idx);
  }, [
    isReady,
    playSegmentAtIndex,
    requireTransport,
    resolveEffectiveSelectedIdx,
    resolveSelectedPlaybackRange,
    transportRef,
    wsRef,
  ]);

  /** Impl for Transport dispatcher — do not wrap again with dispatch. */
  const toggleSelectedWaveformPlayImpl = useCallback(async () => {
    const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
      requireTransport,
    });
    if (!host || !isReady) return;
    const range = resolveSelectedPlaybackRange();
    const bound = segmentPlaybackBoundRef.current;
    const activeScopedBound =
      range != null &&
      isActiveSegmentPlaybackBound(bound, playGenerationRef.current) &&
      bound.startSec === range.start &&
      bound.endSec === range.end;
    const activeUnboundedSelected =
      unboundedSelectedPlayGenRef.current === playGenerationRef.current;
    // Global playback may already be running. In that case the segment button is
    // an explicit "play this segment" request, not a global pause command.
    if (host.isPlaying()) {
      if (
        !segmentBoundStopInFlightRef.current &&
        !activeScopedBound &&
        !activeUnboundedSelected
      ) {
        const idx = resolveEffectiveSelectedIdx();
        const seg = latestSegmentsRef.current[idx];
        if (!seg) return;
        const stickyFromSec = resolveStickySegmentSpaceFromSec({
          segment: seg,
          displaySec: resolvePlayheadSec(),
          rawMediaSec: getRawMediaPlayheadTimeSec?.(),
        });
        await playSegmentAtIndex(
          idx,
          stickyFromSec != null ? { fromSec: stickyFromSec } : undefined,
        );
        return;
      }
      const idx = resolveEffectiveSelectedIdx();
      const rawFreezeSec = getRawMediaPlayheadTimeSec?.();
      const freezeSec =
        typeof rawFreezeSec === "number" && Number.isFinite(rawFreezeSec)
          ? rawFreezeSec
          : resolvePlayheadSec();
      const anchorInsideSelected =
        range != null && freezeSec >= range.start && freezeSec < range.end;
      pausedResumeAnchorRef.current =
        idx >= 0 && anchorInsideSelected ? { idx, timeSec: freezeSec } : null;
      if (idx >= 0) {
        armSegmentPlaybackSession(idx);
      }
      cancelSegmentPlaybackBound();
      await enqueueMediaOp(host.gateHost, "pause", () => {
        host.pause();
      });
      syncDisplayPlayheadAfterSeekRef?.current?.(freezeSec);
      return;
    }
    await playSelectedSegment();
  }, [
    armSegmentPlaybackSession,
    cancelSegmentPlaybackBound,
    getRawMediaPlayheadTimeSec,
    isReady,
    latestSegmentsRef,
    pausedResumeAnchorRef,
    playSegmentAtIndex,
    playSelectedSegment,
    playGenerationRef,
    resolveEffectiveSelectedIdx,
    resolvePlayheadSec,
    resolveSelectedPlaybackRange,
    segmentBoundStopInFlightRef,
    segmentPlaybackBoundRef,
    syncDisplayPlayheadAfterSeekRef,
    requireTransport,
    transportRef,
    unboundedSelectedPlayGenRef,
    wsRef,
  ]);

  const handleToggleSelectedWaveformLoop = useCallback(async () => {
    const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
      requireTransport,
    });
    if (!host || !isReady) return;
    if (segmentLoopPlaybackRef.current) {
      segmentLoopPlaybackRef.current = false;
      setSegmentLoopPlayback(false);
      cancelSegmentPlaybackBound();
      await enqueueMediaOp(host.gateHost, "pause", () => {
        host.pause();
      });
      return;
    }
    const range = resolveSelectedPlaybackRange();
    if (!range) return;
    // Sync ref before await so bound-stop / LoopReplay see loop=on immediately.
    segmentLoopPlaybackRef.current = true;
    setSegmentLoopPlayback(true);
    const idx = resolveEffectiveSelectedIdx();
    if (idx < 0) return;
    // Always restart scoped from a defined point so past-end display cannot
    // resolve as unbounded "gap after" continue.
    const fromSec =
      resolvePlayheadSec() >= range.end - 0.05 ? range.start : undefined;
    await playSegmentAtIndex(
      idx,
      fromSec != null ? { fromSec, loop: true } : { loop: true },
    );
  }, [
    cancelSegmentPlaybackBound,
    isReady,
    playSegmentAtIndex,
    resolveEffectiveSelectedIdx,
    resolvePlayheadSec,
    resolveSelectedPlaybackRange,
    segmentLoopPlaybackRef,
    setSegmentLoopPlayback,
    requireTransport,
    transportRef,
    wsRef,
  ]);

  return {
    playSegmentAtIndex,
    runPlaySegmentResolved,
    playSelectedSegment,
    toggleSelectedWaveformPlayImpl,
    handleToggleSelectedWaveformLoop,
  };
}
