import { useCallback, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { SegmentDto } from "../tauri/projectApi";
import type { ActiveSegmentPlaybackBound } from "../utils/segmentPlaybackBound";
import {
  isSegmentPlaybackSession,
  type PlaybackSession,
} from "../utils/playbackSession";
import { resolveSegmentPauseFreezeSec } from "../utils/segmentResumeFromSec";
import { noteMediaPaused } from "../utils/mediaPlayGate";
import {
  resolveMediaPlaybackHost,
  type PlaybackTransport,
} from "../services/waveform/transport";

export function useWaveformSegmentPlaybackSession(args: {
  wsRef: React.MutableRefObject<WaveSurfer | null>;
  transportRef?: React.MutableRefObject<PlaybackTransport | null>;
  requireTransport?: boolean;
  latestSegmentsRef: React.MutableRefObject<SegmentDto[]>;
  getPlayheadTime: () => number;
  getAuthorityPlayheadTimeSec?: () => number;
  syncDisplayPlayheadAfterSeekRef?: React.MutableRefObject<((timeSec: number) => void) | null>;
  playGenerationRef: React.MutableRefObject<number>;
  segmentPlaybackBoundRef: React.MutableRefObject<ActiveSegmentPlaybackBound | null>;
  unboundedSelectedPlayGenRef: React.MutableRefObject<number | null>;
  globalPlayGenRef: React.MutableRefObject<number | null>;
  pausedResumeAnchorRef: React.MutableRefObject<{ idx: number; timeSec: number } | null>;
  autoStoppedSegmentIdxRef: React.MutableRefObject<number | null>;
  /** Manual pause in flight — hold Stop chrome off until native pause lands. */
  segmentPauseInFlightRef: React.MutableRefObject<boolean>;
  clearSegmentPlaybackBound: (opts?: { preservePlayingChrome?: boolean }) => void;
  setIsSelectedSegmentPlaying: (playing: boolean) => void;
}) {
  const {
    wsRef,
    transportRef,
    requireTransport,
    latestSegmentsRef,
    getPlayheadTime,
    getAuthorityPlayheadTimeSec,
    syncDisplayPlayheadAfterSeekRef,
    playGenerationRef,
    segmentPlaybackBoundRef,
    unboundedSelectedPlayGenRef,
    globalPlayGenRef,
    pausedResumeAnchorRef,
    autoStoppedSegmentIdxRef,
    segmentPauseInFlightRef,
    clearSegmentPlaybackBound,
    setIsSelectedSegmentPlaying,
  } = args;

  /** Bumps when sticky session / blank-global arm changes so playhead chrome re-renders. */
  const [playbackChromeEpoch, setPlaybackChromeEpoch] = useState(0);
  const bumpPlaybackChrome = useCallback(() => {
    setPlaybackChromeEpoch((n) => n + 1);
  }, []);

  /** Sticky Space session: global vs scoped segment (survives pause / natural segment end). */
  const playbackSessionRef = useRef<PlaybackSession | null>(null);
  /**
   * Blank waveform seek: keep transcript selection chrome, but force Space to
   * resume global from the blank playhead until the next segment select/play.
   */
  const blankGlobalSpaceArmedRef = useRef(false);

  const armSegmentPlaybackSession = useCallback((idx: number) => {
    const clearedArm = blankGlobalSpaceArmedRef.current;
    blankGlobalSpaceArmedRef.current = false;
    globalPlayGenRef.current = null;
    const prev = playbackSessionRef.current;
    playbackSessionRef.current = { kind: "segment", idx };
    if (
      clearedArm ||
      prev?.kind !== "segment" ||
      (prev.kind === "segment" && prev.idx !== idx)
    ) {
      bumpPlaybackChrome();
    }
  }, [bumpPlaybackChrome, globalPlayGenRef]);

  /** Mark the next media play as unbounded global (toolbar「全局播放」/ idle Space). */
  const beginGlobalPlayback = useCallback(() => {
    segmentPlaybackBoundRef.current = null;
    unboundedSelectedPlayGenRef.current = null;
    autoStoppedSegmentIdxRef.current = null;
    pausedResumeAnchorRef.current = null;
    const gen = ++playGenerationRef.current;
    globalPlayGenRef.current = gen;
    const prev = playbackSessionRef.current;
    playbackSessionRef.current = { kind: "global" };
    setIsSelectedSegmentPlaying(false);
    if (prev?.kind !== "global") {
      bumpPlaybackChrome();
    }
  }, [
    autoStoppedSegmentIdxRef,
    bumpPlaybackChrome,
    globalPlayGenRef,
    pausedResumeAnchorRef,
    playGenerationRef,
    segmentPlaybackBoundRef,
    setIsSelectedSegmentPlaying,
    unboundedSelectedPlayGenRef,
  ]);

  /** Blank overlay seek: Space should play global from the seek point. */
  const armBlankGlobalSpace = useCallback(() => {
    if (blankGlobalSpaceArmedRef.current) return;
    blankGlobalSpaceArmedRef.current = true;
    bumpPlaybackChrome();
  }, [bumpPlaybackChrome]);

  /** Segment select / listen-jump: restore Space → selected-segment rule. */
  const clearBlankGlobalSpaceArm = useCallback(() => {
    if (!blankGlobalSpaceArmedRef.current) return;
    blankGlobalSpaceArmedRef.current = false;
    bumpPlaybackChrome();
  }, [bumpPlaybackChrome]);

  const isBlankGlobalSpaceArmed = useCallback(
    () => blankGlobalSpaceArmedRef.current,
    [],
  );

  /** Space / global pause: stop media but keep sticky session for resume. */
  const pauseMediaKeepingSession = useCallback(() => {
    const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
      requireTransport,
    });
    if (!host) return;
    const session = playbackSessionRef.current;
    if (isSegmentPlaybackSession(session)) {
      const seg = latestSegmentsRef.current[session.idx];
      const normalizedFreezeSec = resolveSegmentPauseFreezeSec({
        displaySec: getPlayheadTime(),
        authoritySec: getAuthorityPlayheadTimeSec?.(),
      });
      const anchorInsideSession =
        seg != null &&
        normalizedFreezeSec >= Math.min(seg.start_sec, seg.end_sec) &&
        normalizedFreezeSec < Math.max(seg.start_sec, seg.end_sec);
      pausedResumeAnchorRef.current = anchorInsideSession
        ? {
            idx: session.idx,
            timeSec: normalizedFreezeSec,
          }
        : null;
      autoStoppedSegmentIdxRef.current = null;
      segmentPlaybackBoundRef.current = null;
      unboundedSelectedPlayGenRef.current = null;
      globalPlayGenRef.current = null;
      playGenerationRef.current += 1;
      // Async native pause: hold Stop chrome off until it lands (sync clears the flag).
      segmentPauseInFlightRef.current = true;
      setIsSelectedSegmentPlaying(false);
      void Promise.resolve(host.pause());
      noteMediaPaused(host.gateHost);
      syncDisplayPlayheadAfterSeekRef?.current?.(normalizedFreezeSec);
      return;
    }
    playbackSessionRef.current = { kind: "global" };
    clearSegmentPlaybackBound();
    void Promise.resolve(host.pause());
    noteMediaPaused(host.gateHost);
  }, [
    autoStoppedSegmentIdxRef,
    clearSegmentPlaybackBound,
    getAuthorityPlayheadTimeSec,
    getPlayheadTime,
    globalPlayGenRef,
    latestSegmentsRef,
    pausedResumeAnchorRef,
    playGenerationRef,
    requireTransport,
    segmentPauseInFlightRef,
    segmentPlaybackBoundRef,
    setIsSelectedSegmentPlaying,
    syncDisplayPlayheadAfterSeekRef,
    transportRef,
    unboundedSelectedPlayGenRef,
    wsRef,
  ]);

  const isSegmentPlaybackSessionActive = useCallback(() => {
    return isSegmentPlaybackSession(playbackSessionRef.current);
  }, []);

  const getPlaybackSession = useCallback((): PlaybackSession | null => {
    return playbackSessionRef.current;
  }, []);

  return {
    playbackChromeEpoch,
    playbackSessionRef,
    armSegmentPlaybackSession,
    beginGlobalPlayback,
    armBlankGlobalSpace,
    clearBlankGlobalSpaceArm,
    isBlankGlobalSpaceArmed,
    pauseMediaKeepingSession,
    isSegmentPlaybackSession: isSegmentPlaybackSessionActive,
    getPlaybackSession,
  };
}
