import { useCallback } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { SegmentDto } from "../tauri/projectApi";
import {
  isActiveSegmentPlaybackBound,
  type ActiveSegmentPlaybackBound,
} from "../utils/segmentPlaybackBound";
import {
  resolveSegmentPlayFrom,
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
import { endMediaPlay, tryBeginMediaPlay } from "../utils/mediaPlayGate";

export type PlaySegmentAtIndexOptions = {
  /** Tab 听打：切段后自动循环当前语段。 */
  loop?: boolean;
  /** 显式起播时刻（点击/双击）；钳在语段内。 */
  fromSec?: number;
};

export type WaveformSegmentPlayActionsArgs = {
  wsRef: React.MutableRefObject<WaveSurfer | null>;
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

  const applyGlobalPlaybackRate = useCallback(() => {
    applyWaveformGlobalPlaybackRate({
      ws: wsRef.current,
      getGlobalPlaybackRate,
    });
  }, [getGlobalPlaybackRate, wsRef]);

  /** Transport Authority: play with play-from already resolved by dispatcher. */
  const runPlaySegmentResolved = useCallback(
    async (playArgs: {
      idx: number;
      playFrom: SegmentPlayFromResolution;
      loop?: boolean;
    }) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      const seg = latestSegmentsRef.current[playArgs.idx];
      if (!seg) return;
      // Hold the play gate across seek+play so Space/toggle cannot nest play().
      if (!tryBeginMediaPlay(ws)) return;
      const gen = ++playGenerationRef.current;
      playStartInFlightGenerationRef.current = gen;
      clearSegmentPlaybackBound();
      if (ws.isPlaying()) {
        ws.pause();
      }
      const range = {
        start: Math.min(seg.start_sec, seg.end_sec),
        end: Math.max(seg.start_sec, seg.end_sec),
      };
      applyGlobalPlaybackRate();
      if (playArgs.loop) {
        setSegmentLoopPlayback(true);
      }
      let startAtSec = resolvePlayheadSec();
      if (playArgs.playFrom.kind === "seek") {
        startAtSec = playArgs.playFrom.timeSec;
        atomicMediaSeek(playArgs.playFrom.timeSec);
      }
      try {
        await ws.play();
      } catch {
        if (playStartInFlightGenerationRef.current === gen) {
          playStartInFlightGenerationRef.current = null;
        }
        if (gen !== playGenerationRef.current) return;
        clearSegmentPlaybackBound();
        return;
      } finally {
        endMediaPlay(ws);
      }
      if (gen !== playGenerationRef.current) {
        if (playStartInFlightGenerationRef.current === gen) {
          playStartInFlightGenerationRef.current = null;
        }
        if (ws.isPlaying()) ws.pause();
        return;
      }
      if (playStartInFlightGenerationRef.current === gen) {
        playStartInFlightGenerationRef.current = null;
      }
      if (!ws.isPlaying()) return;

      // Only scope-stop at segment end when starting inside the selected segment.
      // Past end (gap after): free play from playhead — keep Stop chrome via unbounded gen.
      const insideAtStart = startAtSec >= range.start && startAtSec < range.end;
      if (insideAtStart) {
        unboundedSelectedPlayGenRef.current = null;
        segmentPlaybackBoundRef.current = {
          startSec: range.start,
          endSec: range.end,
          generation: gen,
          armed: false,
        };
      } else {
        segmentPlaybackBoundRef.current = null;
        unboundedSelectedPlayGenRef.current = gen;
      }
      setIsSelectedSegmentPlaying(true);
      armSegmentPlaybackSession(playArgs.idx);
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
      unboundedSelectedPlayGenRef,
      wsRef,
    ],
  );

  const playSegmentAtIndex = useCallback(
    async (idx: number, options?: PlaySegmentAtIndexOptions) => {
      const seg = latestSegmentsRef.current[idx];
      if (!seg) return;
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
    const ws = wsRef.current;
    const idx = resolveEffectiveSelectedIdx();
    const range = resolveSelectedPlaybackRange();
    if (!ws || !isReady || idx < 0 || !range) return;
    await playSegmentAtIndex(idx);
  }, [
    isReady,
    playSegmentAtIndex,
    resolveEffectiveSelectedIdx,
    resolveSelectedPlaybackRange,
    wsRef,
  ]);

  /** Impl for Transport dispatcher — do not wrap again with dispatch. */
  const toggleSelectedWaveformPlayImpl = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
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
    if (ws.isPlaying()) {
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
      ws.pause();
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
    unboundedSelectedPlayGenRef,
    wsRef,
  ]);

  const handleToggleSelectedWaveformLoop = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    if (segmentLoopPlaybackRef.current) {
      setSegmentLoopPlayback(false);
      cancelSegmentPlaybackBound();
      ws.pause();
      return;
    }
    const range = resolveSelectedPlaybackRange();
    if (!range) return;
    setSegmentLoopPlayback(true);
    await playSelectedSegment();
  }, [
    cancelSegmentPlaybackBound,
    isReady,
    playSelectedSegment,
    resolveSelectedPlaybackRange,
    segmentLoopPlaybackRef,
    setSegmentLoopPlayback,
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
