import { useCallback } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { SegmentDto } from "../tauri/projectApi";
import {
  isActiveSegmentPlaybackBound,
  type ActiveSegmentPlaybackBound,
} from "../utils/segmentPlaybackBound";
import {
  resolveMediaPlaybackHost,
  type PlaybackTransport,
} from "../services/waveform/transport";
import {
  resolveSegmentPauseFreezeSec,
  resolveStickySegmentSpaceFromSec,
} from "../utils/segmentResumeFromSec";
import { enqueueMediaOp } from "../utils/mediaPlayGate";
import {
  resolveLoopTogglePlayOptions,
  shouldPlayThisSegmentInsteadOfPause,
} from "../services/waveform/segmentPlayBoundArm";

export function useWaveformSegmentPlayToggle(args: {
  wsRef: React.MutableRefObject<WaveSurfer | null>;
  transportRef?: React.MutableRefObject<PlaybackTransport | null>;
  requireTransport?: boolean;
  isReady: boolean;
  latestSegmentsRef: React.MutableRefObject<SegmentDto[]>;
  getAuthorityPlayheadTimeSec?: () => number;
  resolvePlayheadSec: () => number;
  resolveEffectiveSelectedIdx: () => number;
  resolveSelectedPlaybackRange: () => { start: number; end: number } | null;
  playGenerationRef: React.MutableRefObject<number>;
  segmentBoundStopInFlightRef: React.MutableRefObject<boolean>;
  segmentPlaybackBoundRef: React.MutableRefObject<ActiveSegmentPlaybackBound | null>;
  unboundedSelectedPlayGenRef: React.MutableRefObject<number | null>;
  pausedResumeAnchorRef: React.MutableRefObject<{ idx: number; timeSec: number } | null>;
  segmentLoopPlaybackRef: React.MutableRefObject<boolean>;
  cancelSegmentPlaybackBound: () => void;
  setSegmentLoopPlayback: (loop: boolean) => void;
  armSegmentPlaybackSession: (idx: number) => void;
  syncDisplayPlayheadAfterSeekRef?: React.MutableRefObject<((timeSec: number) => void) | null>;
  playSegmentAtIndex: (
    idx: number,
    options?: { loop?: boolean; fromSec?: number },
  ) => Promise<void>;
  playSelectedSegment: () => Promise<void>;
}) {
  const {
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
  } = args;

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
        shouldPlayThisSegmentInsteadOfPause({
          segmentBoundStopInFlight: segmentBoundStopInFlightRef.current,
          activeScopedBound,
          activeUnboundedSelected,
        })
      ) {
        const idx = resolveEffectiveSelectedIdx();
        const seg = latestSegmentsRef.current[idx];
        if (!seg) return;
        const stickyFromSec = resolveStickySegmentSpaceFromSec({
          segment: seg,
          displaySec: resolvePlayheadSec(),
          authoritySec: getAuthorityPlayheadTimeSec?.(),
        });
        await playSegmentAtIndex(
          idx,
          stickyFromSec != null ? { fromSec: stickyFromSec } : undefined,
        );
        return;
      }
      const idx = resolveEffectiveSelectedIdx();
      const freezeSec = resolveSegmentPauseFreezeSec({
        displaySec: resolvePlayheadSec(),
        authoritySec: getAuthorityPlayheadTimeSec?.(),
      });
      const anchorInsideSelected =
        range != null && freezeSec >= range.start && freezeSec < range.end;
      pausedResumeAnchorRef.current =
        idx >= 0 && anchorInsideSelected ? { idx, timeSec: freezeSec } : null;
      if (idx >= 0) {
        armSegmentPlaybackSession(idx);
      }
      cancelSegmentPlaybackBound();
      await enqueueMediaOp(
        host.gateHost,
        "pause",
        () => {
          void Promise.resolve(host.pause());
        },
        host.isNative ? { pauseToPlayGapMs: 0 } : undefined,
      );
      syncDisplayPlayheadAfterSeekRef?.current?.(freezeSec);
      return;
    }
    await playSelectedSegment();
  }, [
    armSegmentPlaybackSession,
    cancelSegmentPlaybackBound,
    getAuthorityPlayheadTimeSec,
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
      await enqueueMediaOp(
        host.gateHost,
        "pause",
        () => {
          void Promise.resolve(host.pause());
        },
        host.isNative ? { pauseToPlayGapMs: 0 } : undefined,
      );
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
    const options = resolveLoopTogglePlayOptions({
      playheadSec: resolvePlayheadSec(),
      rangeStart: range.start,
      rangeEnd: range.end,
    });
    await playSegmentAtIndex(idx, options);
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
    toggleSelectedWaveformPlayImpl,
    handleToggleSelectedWaveformLoop,
  };
}
