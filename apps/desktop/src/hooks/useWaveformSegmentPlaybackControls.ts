import { useCallback, useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { SegmentDto } from "../tauri/projectApi";
import type { ActiveSegmentPlaybackBound } from "../utils/segmentPlaybackBound";
import {
  isSegmentPlaybackSession,
  type PlaybackSession,
} from "../utils/playbackSession";
import { resolveSegmentResumeFromSec } from "../utils/segmentResumeFromSec";
import { effectiveTranscriptPrimaryIdx } from "../components/editor/core/projectionWaveformBridge";
import {
  useWaveformSegmentPlayActions,
  type PlaySegmentAtIndexOptions,
} from "./useWaveformSegmentPlayActions";
import { useWaveformSegmentPlaybackBoundSync } from "./useWaveformSegmentPlaybackBoundSync";
import { useWaveformSegmentLoopReplay } from "./useWaveformSegmentLoopReplay";

export type { PlaySegmentAtIndexOptions };

export function useWaveformSegmentPlaybackControls(args: {
  wsRef: React.MutableRefObject<WaveSurfer | null>;
  isReady: boolean;
  segments: SegmentDto[];
  selectedIdx: number;
  getGlobalPlaybackRate: () => number;
  getPlayheadTime: () => number;
  /** Raw media `currentTime` — used only to detect "already inside this segment" on resume. */
  getRawMediaPlayheadTimeSec?: () => number;
  syncDisplayPlayheadAfterSeekRef?: React.MutableRefObject<((timeSec: number) => void) | null>;
  layoutDurationSecRef?: React.MutableRefObject<number>;
  commitSeekUi?: (timeSec: number) => void;
}) {
  const {
    wsRef,
    isReady,
    segments,
    selectedIdx,
    getGlobalPlaybackRate,
    getPlayheadTime,
    getRawMediaPlayheadTimeSec,
    syncDisplayPlayheadAfterSeekRef,
    layoutDurationSecRef,
    commitSeekUi,
  } = args;
  const [segmentLoopPlayback, setSegmentLoopPlayback] = useState(false);
  const [isSelectedSegmentPlaying, setIsSelectedSegmentPlaying] = useState(false);
  const latestSegmentsRef = useRef(segments);
  latestSegmentsRef.current = segments;
  const selectedIdxRef = useRef(selectedIdx);
  selectedIdxRef.current = selectedIdx;
  const segmentLoopPlaybackRef = useRef(segmentLoopPlayback);
  segmentLoopPlaybackRef.current = segmentLoopPlayback;
  const isSelectedSegmentPlayingRef = useRef(isSelectedSegmentPlaying);
  isSelectedSegmentPlayingRef.current = isSelectedSegmentPlaying;
  const preserveLoopOnNextSelectRef = useRef(false);
  const pausedResumeAnchorRef = useRef<{ idx: number; timeSec: number } | null>(null);
  const autoStoppedSegmentIdxRef = useRef<number | null>(null);
  /** Sticky Space session: global vs scoped segment (survives pause / natural segment end). */
  const playbackSessionRef = useRef<PlaybackSession | null>(null);

  const clearPausedResumeAnchor = useCallback(() => {
    pausedResumeAnchorRef.current = null;
    autoStoppedSegmentIdxRef.current = null;
  }, []);

  /**
   * Consume sticky resume intent for Transport `resolvePlayFromInput`.
   * Must run before resolveSegmentPlayFrom so Space-after-natural-end seeks to start.
   */
  const consumeSegmentResumeFromSec = useCallback(
    (idx: number, explicitFromSec?: number): number | undefined => {
      const seg = latestSegmentsRef.current[idx];
      if (!seg) return explicitFromSec;
      const fromSec = resolveSegmentResumeFromSec({
        segment: seg,
        targetIdx: idx,
        explicitFromSec,
        autoStoppedIdx: autoStoppedSegmentIdxRef.current,
        pausedAnchor: pausedResumeAnchorRef.current,
      });
      pausedResumeAnchorRef.current = null;
      autoStoppedSegmentIdxRef.current = null;
      return fromSec;
    },
    [],
  );

  /** Flag-on: CM6 projection primary (SC1 bridge fallback). */
  const resolveEffectiveSelectedIdx = useCallback(() => {
    return effectiveTranscriptPrimaryIdx(selectedIdxRef.current);
  }, []);

  const resolveSelectedPlaybackRange = useCallback(() => {
    const idx = resolveEffectiveSelectedIdx();
    const seg = latestSegmentsRef.current[idx];
    if (!seg) return null;
    return {
      start: Math.min(seg.start_sec, seg.end_sec),
      end: Math.max(seg.start_sec, seg.end_sec),
    };
  }, [resolveEffectiveSelectedIdx]);

  const playGenerationRef = useRef(0);
  const segmentPlaybackBoundRef = useRef<ActiveSegmentPlaybackBound | null>(null);
  const segmentBoundStopInFlightRef = useRef(false);
  const playStartInFlightGenerationRef = useRef<number | null>(null);
  /** Play started past selected end (no end-bound); keep Stop chrome until pause. */
  const unboundedSelectedPlayGenRef = useRef<number | null>(null);
  /** Global continuous play — sync must not auto-arm segment end-bound. */
  const globalPlayGenRef = useRef<number | null>(null);

  const clearSegmentPlaybackBound = useCallback(() => {
    segmentPlaybackBoundRef.current = null;
    unboundedSelectedPlayGenRef.current = null;
    globalPlayGenRef.current = null;
    autoStoppedSegmentIdxRef.current = null;
    setIsSelectedSegmentPlaying(false);
  }, []);

  /** Drop bound and invalidate queued end-stop microtasks (user pause / stop). Keeps sticky session. */
  const cancelSegmentPlaybackBound = useCallback(() => {
    segmentPlaybackBoundRef.current = null;
    unboundedSelectedPlayGenRef.current = null;
    globalPlayGenRef.current = null;
    autoStoppedSegmentIdxRef.current = null;
    playGenerationRef.current += 1;
    setIsSelectedSegmentPlaying(false);
  }, []);

  const armSegmentPlaybackSession = useCallback((idx: number) => {
    playbackSessionRef.current = { kind: "segment", idx };
  }, []);

  /** Mark the next media play as unbounded global (toolbar「全局播放」/ idle Space). */
  const beginGlobalPlayback = useCallback(() => {
    segmentPlaybackBoundRef.current = null;
    unboundedSelectedPlayGenRef.current = null;
    autoStoppedSegmentIdxRef.current = null;
    pausedResumeAnchorRef.current = null;
    const gen = ++playGenerationRef.current;
    globalPlayGenRef.current = gen;
    playbackSessionRef.current = { kind: "global" };
    setIsSelectedSegmentPlaying(false);
  }, []);

  /** Space / global pause: stop media but keep sticky session for resume. */
  const pauseMediaKeepingSession = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const session = playbackSessionRef.current;
    if (isSegmentPlaybackSession(session)) {
      const seg = latestSegmentsRef.current[session.idx];
      const rawFreezeSec = getRawMediaPlayheadTimeSec?.();
      const freezeSec =
        typeof rawFreezeSec === "number" && Number.isFinite(rawFreezeSec)
          ? rawFreezeSec
          : getPlayheadTime();
      const normalizedFreezeSec = Number.isFinite(freezeSec) ? freezeSec : 0;
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
      setIsSelectedSegmentPlaying(false);
      ws.pause();
      syncDisplayPlayheadAfterSeekRef?.current?.(normalizedFreezeSec);
      return;
    }
    playbackSessionRef.current = { kind: "global" };
    clearSegmentPlaybackBound();
    ws.pause();
  }, [
    clearSegmentPlaybackBound,
    getPlayheadTime,
    getRawMediaPlayheadTimeSec,
    syncDisplayPlayheadAfterSeekRef,
    wsRef,
  ]);

  const isSegmentPlaybackSessionActive = useCallback(() => {
    return isSegmentPlaybackSession(playbackSessionRef.current);
  }, []);

  const getPlaybackSession = useCallback((): PlaybackSession | null => {
    return playbackSessionRef.current;
  }, []);

  const resolveNaturalEndReplayIdx = useCallback(() => {
    const session = playbackSessionRef.current;
    if (isSegmentPlaybackSession(session)) return session.idx;
    return resolveEffectiveSelectedIdx();
  }, [resolveEffectiveSelectedIdx]);

  const resolvePlayheadSec = useCallback(() => {
    const t = getPlayheadTime();
    return Number.isFinite(t) ? t : 0;
  }, [getPlayheadTime]);

  const {
    playSegmentAtIndex,
    runPlaySegmentResolved,
    playSelectedSegment,
    toggleSelectedWaveformPlayImpl,
    handleToggleSelectedWaveformLoop,
  } = useWaveformSegmentPlayActions({
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
  });

  const { syncSelectedSegmentPlayingUi } = useWaveformSegmentPlaybackBoundSync({
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
  });

  useWaveformSegmentLoopReplay({
    wsRef,
    isReady,
    segmentLoopPlayback,
    segmentLoopPlaybackRef,
    resolvePlayheadSec,
    resolveSelectedPlaybackRange,
    playSelectedSegment,
  });

  useEffect(() => {
    const anchor = pausedResumeAnchorRef.current;
    if (anchor && anchor.idx !== resolveEffectiveSelectedIdx()) {
      pausedResumeAnchorRef.current = null;
    }
    if (
      autoStoppedSegmentIdxRef.current != null &&
      autoStoppedSegmentIdxRef.current !== resolveEffectiveSelectedIdx()
    ) {
      autoStoppedSegmentIdxRef.current = null;
    }
    if (preserveLoopOnNextSelectRef.current) {
      preserveLoopOnNextSelectRef.current = false;
      return;
    }
    setSegmentLoopPlayback(false);
    // Do not blindly clear playing UI while media is still playing — sync against
    // the new selection (re-arms bound when playhead is already inside / after seek).
    syncSelectedSegmentPlayingUi();
  }, [resolveEffectiveSelectedIdx, selectedIdx, syncSelectedSegmentPlayingUi]);

  const preserveLoopForNextSegmentSelect = useCallback(() => {
    preserveLoopOnNextSelectRef.current = true;
  }, []);

  return {
    segmentLoopPlayback,
    isSelectedSegmentPlaying,
    preserveLoopForNextSegmentSelect,
    playSegmentAtIndex,
    runPlaySegmentResolved,
    toggleSelectedWaveformPlayImpl,
    clearSegmentPlaybackBound,
    clearPausedResumeAnchor,
    consumeSegmentResumeFromSec,
    beginGlobalPlayback,
    pauseMediaKeepingSession,
    isSegmentPlaybackSession: isSegmentPlaybackSessionActive,
    getPlaybackSession,
    handleToggleSelectedWaveformLoop,
    handleToggleSelectedWaveformPlay: toggleSelectedWaveformPlayImpl,
  };
}
