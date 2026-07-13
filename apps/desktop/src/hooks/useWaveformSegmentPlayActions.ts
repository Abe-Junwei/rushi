import { useCallback } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { SegmentDto } from "../tauri/projectApi";
import type { ActiveSegmentPlaybackBound } from "../utils/segmentPlaybackBound";
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
import { resolveSegmentResumeFromSec } from "../utils/segmentResumeFromSec";
import { endMediaPlay, enqueueMediaOp, tryBeginMediaPlay } from "../utils/mediaPlayGate";
import { resolveSegmentBoundArmAfterPlayStart } from "../services/waveform/segmentPlayBoundArm";
import { useWaveformSegmentPlayToggle } from "./useWaveformSegmentPlayToggle";

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
  getAuthorityPlayheadTimeSec?: () => number;
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
    getAuthorityPlayheadTimeSec,
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
      const gateOpts = host.isNative ? { pauseToPlayGapMs: 0 } : undefined;
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
            }, gateOpts);
          }
        } else {
          if (seekToSec != null) {
            await enqueueMediaOp(host.gateHost, "seek", async () => {
              await atomicMediaSeek(seekToSec);
            }, gateOpts);
          }
          try {
            await enqueueMediaOp(host.gateHost, "play", async () => {
              await host.play();
            }, gateOpts);
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
              void Promise.resolve(host.pause());
            }, gateOpts);
          }
          return;
        }
        if (playStartInFlightGenerationRef.current === gen) {
          playStartInFlightGenerationRef.current = null;
        }
        if (!host.isPlaying()) return;

        // Only scope-stop at segment end when starting inside the selected segment.
        // Past end (gap after): free play from playhead — keep Stop chrome via unbounded gen.
        const arm = resolveSegmentBoundArmAfterPlayStart({
          startAtSec,
          rangeStart: range.start,
          rangeEnd: range.end,
          generation: gen,
        });
        segmentPlaybackBoundRef.current = arm.bound;
        unboundedSelectedPlayGenRef.current = arm.unboundedSelectedPlayGen;
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
        authoritySec: getAuthorityPlayheadTimeSec?.(),
      });
      await runPlaySegmentResolved({
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
    runPlaySegmentResolved,
    playSelectedSegment,
    toggleSelectedWaveformPlayImpl,
    handleToggleSelectedWaveformLoop,
  };
}
