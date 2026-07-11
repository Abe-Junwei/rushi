import { useCallback, useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { SegmentDto } from "../tauri/projectApi";
import type { ActiveSegmentPlaybackBound } from "../utils/segmentPlaybackBound";
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

  const clearPausedResumeAnchor = useCallback(() => {
    pausedResumeAnchorRef.current = null;
    autoStoppedSegmentIdxRef.current = null;
  }, []);

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

  /** Drop bound and invalidate queued end-stop microtasks (user pause / stop). */
  const cancelSegmentPlaybackBound = useCallback(() => {
    segmentPlaybackBoundRef.current = null;
    unboundedSelectedPlayGenRef.current = null;
    globalPlayGenRef.current = null;
    autoStoppedSegmentIdxRef.current = null;
    playGenerationRef.current += 1;
    setIsSelectedSegmentPlaying(false);
  }, []);

  /** Mark the next media play as unbounded global (Space / toolbar main button). */
  const beginGlobalPlayback = useCallback(() => {
    segmentPlaybackBoundRef.current = null;
    unboundedSelectedPlayGenRef.current = null;
    autoStoppedSegmentIdxRef.current = null;
    const gen = ++playGenerationRef.current;
    globalPlayGenRef.current = gen;
    setIsSelectedSegmentPlaying(false);
  }, []);

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
    beginGlobalPlayback,
    handleToggleSelectedWaveformLoop,
    handleToggleSelectedWaveformPlay: toggleSelectedWaveformPlayImpl,
  };
}
