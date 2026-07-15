import { useCallback } from "react";
import {
  resolveMediaPlaybackHost,
  resolveSegmentPlayFrom,
  type SegmentPlayFromResolution,
} from "../services/waveform/transport";
import {
  applyWaveformGlobalPlaybackRate,
  atomicWaveformSegmentSeek,
} from "../services/waveform/waveformSegmentPlaybackSeek";
import { resolveSegmentResumeFromSec } from "../utils/segmentResumeFromSec";
import { runPlaySegmentResolved } from "../services/waveform/runPlaySegmentResolved";
import { useWaveformSegmentPlayToggle } from "./useWaveformSegmentPlayToggle";
import type {
  PlaySegmentAtIndexOptions,
  WaveformSegmentPlayActionsArgs,
} from "./useWaveformSegmentPlayActionsTypes";

export type {
  PlaySegmentAtIndexOptions,
  WaveformSegmentPlayActionsArgs,
} from "./useWaveformSegmentPlayActionsTypes";

/** Segment play / toggle / loop transport actions (Transport Authority play-from). */
export function useWaveformSegmentPlayActions(args: WaveformSegmentPlayActionsArgs) {
  const {
    wsRef,
    transportRef,
    requireTransport,
    isReady,
    latestSegmentsRef,
    getGlobalPlaybackRate,
    getAuthorityPlayheadTimeSec,
    resolvePlayheadSec,
    resolveEffectiveSelectedIdx,
    resolveSelectedPlaybackRange,
    playGenerationRef,
    segmentBoundStopInFlightRef,
    playStartInFlightGenerationRef,
    segmentPauseInFlightRef,
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
    beginVisualSeekRef,
    endVisualSeekRef,
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
        beginVisualSeekRef,
        endVisualSeekRef,
        commitSeekUi,
      });
    },
    [
      beginVisualSeekRef,
      commitSeekUi,
      endVisualSeekRef,
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

  const runPlaySegmentResolvedCb = useCallback(
    async (playArgs: {
      idx: number;
      playFrom: SegmentPlayFromResolution;
      loop?: boolean;
    }) => {
      await runPlaySegmentResolved({
        ws: wsRef.current,
        transport: transportRef?.current,
        requireTransport,
        isReady,
        segment: latestSegmentsRef.current[playArgs.idx],
        playFrom: playArgs.playFrom,
        loop: playArgs.loop,
        playGenerationRef,
        playStartInFlightGenerationRef,
        segmentPauseInFlightRef,
        segmentPlaybackBoundRef,
        unboundedSelectedPlayGenRef,
        segmentLoopPlaybackRef,
        clearSegmentPlaybackBound,
        setSegmentLoopPlayback,
        setIsSelectedSegmentPlaying,
        armSegmentPlaybackSession,
        applyGlobalPlaybackRate,
        atomicMediaSeek,
        resolvePlayheadSec,
        idx: playArgs.idx,
      });
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
      segmentPauseInFlightRef,
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
        authoritySec: getAuthorityPlayheadTimeSec?.(),
      });
      await runPlaySegmentResolvedCb({
        idx,
        playFrom,
        loop: options?.loop,
      });
    },
    [
      autoStoppedSegmentIdxRef,
      getAuthorityPlayheadTimeSec,
      latestSegmentsRef,
      pausedResumeAnchorRef,
      resolvePlayheadSec,
      runPlaySegmentResolvedCb,
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

  const { toggleSelectedWaveformPlayImpl, handleToggleSelectedWaveformLoop } =
    useWaveformSegmentPlayToggle({
      wsRef,
      transportRef,
      requireTransport,
      isReady,
      latestSegmentsRef,
      getAuthorityPlayheadTimeSec,
      resolvePlayheadSec,
      resolveEffectiveSelectedIdx,
      resolveSelectedPlaybackRange,
      playGenerationRef,
      segmentBoundStopInFlightRef,
      segmentPauseInFlightRef,
      segmentPlaybackBoundRef,
      unboundedSelectedPlayGenRef,
      pausedResumeAnchorRef,
      segmentLoopPlaybackRef,
      cancelSegmentPlaybackBound,
      setSegmentLoopPlayback,
      armSegmentPlaybackSession,
      syncDisplayPlayheadAfterSeekRef,
      playSegmentAtIndex,
      playSelectedSegment,
    });

  return {
    playSegmentAtIndex,
    runPlaySegmentResolved: runPlaySegmentResolvedCb,
    playSelectedSegment,
    toggleSelectedWaveformPlayImpl,
    handleToggleSelectedWaveformLoop,
  };
}
