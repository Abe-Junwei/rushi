import { useCallback, useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { SegmentDto } from "../tauri/projectApi";

import {
  armSegmentPlaybackSession,
  isActiveSegmentPlaybackBound,
  segmentPlaybackReachedEnd,
  type ActiveSegmentPlaybackBound,
} from "../utils/segmentPlaybackBound";
import {
  applyPeaksOrderedSeek,
  resolveSegmentPlayFrom,
  type SegmentPlayFromResolution,
} from "../services/waveform/transport";
import {
  selectionChromeEffectivePrimaryIdx,
  subscribeSelectionChrome,
} from "../services/selection/selectionChromeStore";
import { subscribePlaybackFrame } from "../utils/tierScrollFrameCoordinator";
import { resolveLayoutDurationSec } from "../utils/waveformTimelineMetrics";

export type PlaySegmentAtIndexOptions = {
  /** Tab 听打：切段后自动循环当前语段。 */
  loop?: boolean;
  /** 显式起播时刻（点击/双击）；钳在语段内。 */
  fromSec?: number;
};

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

  const clearPausedResumeAnchor = useCallback(() => {
    pausedResumeAnchorRef.current = null;
  }, []);

  /** Visual chrome (SC2) may lead React SC1 after select — Space must play the painted segment. */
  const resolveEffectiveSelectedIdx = useCallback(() => {
    return selectionChromeEffectivePrimaryIdx(selectedIdxRef.current);
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

  const clearSegmentPlaybackBound = useCallback(() => {
    segmentPlaybackBoundRef.current = null;
    unboundedSelectedPlayGenRef.current = null;
    setIsSelectedSegmentPlaying(false);
  }, []);

  /** Drop bound and invalidate queued end-stop microtasks (user pause / stop). */
  const cancelSegmentPlaybackBound = useCallback(() => {
    segmentPlaybackBoundRef.current = null;
    unboundedSelectedPlayGenRef.current = null;
    playGenerationRef.current += 1;
    setIsSelectedSegmentPlaying(false);
  }, []);

  const applyGlobalPlaybackRate = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.setPlaybackRate(getGlobalPlaybackRate());
  }, [getGlobalPlaybackRate, wsRef]);

  const resolvePlayheadSec = useCallback(() => {
    const t = getPlayheadTime();
    return Number.isFinite(t) ? t : 0;
  }, [getPlayheadTime]);

  const atomicMediaSeek = useCallback(
    (timeSec: number) => {
      const ws = wsRef.current;
      if (!ws) return;
      const d = layoutDurationSecRef
        ? resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current })
        : ws.getDuration() || 0;
      applyPeaksOrderedSeek({
        timeSec,
        durationSec: d,
        syncDisplayPlayheadAfterSeek: (t) => syncDisplayPlayheadAfterSeekRef?.current?.(t),
        setTime: (t) => ws.setTime(t),
        commitSeekUi,
      });
    },
    [commitSeekUi, layoutDurationSecRef, syncDisplayPlayheadAfterSeekRef, wsRef],
  );

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
    },
    [
      applyGlobalPlaybackRate,
      atomicMediaSeek,
      clearSegmentPlaybackBound,
      isReady,
      resolvePlayheadSec,
      wsRef,
    ],
  );

  const playSegmentAtIndex = useCallback(
    async (idx: number, options?: PlaySegmentAtIndexOptions) => {
      const seg = latestSegmentsRef.current[idx];
      if (!seg) return;
      const pausedAnchor = pausedResumeAnchorRef.current;
      const resumeFromSec =
        options?.fromSec == null && pausedAnchor?.idx === idx
          ? pausedAnchor.timeSec
          : options?.fromSec;
      pausedResumeAnchorRef.current = null;
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
    [getRawMediaPlayheadTimeSec, resolvePlayheadSec, runPlaySegmentResolved],
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
    // Pause decision must follow live media only. A stale `isSelectedSegmentPlaying`
    // (React lag / select-while-playing sync) must not block starting playback.
    if (ws.isPlaying()) {
      const idx = resolveEffectiveSelectedIdx();
      const rawFreezeSec = getRawMediaPlayheadTimeSec?.();
      const freezeSec =
        typeof rawFreezeSec === "number" && Number.isFinite(rawFreezeSec)
          ? rawFreezeSec
          : resolvePlayheadSec();
      pausedResumeAnchorRef.current =
        idx >= 0 ? { idx, timeSec: freezeSec } : null;
      cancelSegmentPlaybackBound();
      ws.pause();
      syncDisplayPlayheadAfterSeekRef?.current?.(freezeSec);
      return;
    }
    await playSelectedSegment();
  }, [
    cancelSegmentPlaybackBound,
    getRawMediaPlayheadTimeSec,
    isReady,
    playSelectedSegment,
    resolveEffectiveSelectedIdx,
    resolvePlayheadSec,
    syncDisplayPlayheadAfterSeekRef,
    wsRef,
  ]);

  const handleToggleSelectedWaveformPlay = toggleSelectedWaveformPlayImpl;

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
  }, [cancelSegmentPlaybackBound, isReady, playSelectedSegment, resolveSelectedPlaybackRange, wsRef]);

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
          segmentPlaybackBoundRef.current = null;
          setIsSelectedSegmentPlaying(false);
          // Freeze at segment end — never seek back to start on auto-stop.
          // Next Space uses resolveSegmentPlayFrom → playhead (may be at end / past).
          const clampedEnd = Math.max(0, Math.min(endSec, live.getDuration()));
          if (Number.isFinite(clampedEnd)) {
            atomicMediaSeek(clampedEnd);
          }
        }
      });
    },
    [atomicMediaSeek, isReady, resolvePlayheadSec, wsRef],
  );

  /**
   * Keep overlay/toolbar play icon + segment end-bound in sync with live media
   * and the selected segment. Selecting while playing used to clear the bound and
   * leave the control stuck on "play".
   *
   * Do not clear an active bound that has already passed end — that race let
   * media continue as unbounded global play after WS-2b sparse audioprocess.
   */
  const syncSelectedSegmentPlayingUi = useCallback((playheadTimeSec?: number) => {
    const ws = wsRef.current;
    if (!ws || !isReady) {
      if (isSelectedSegmentPlayingRef.current) setIsSelectedSegmentPlaying(false);
      return;
    }
    if (!ws.isPlaying()) {
      if (segmentPlaybackBoundRef.current) segmentPlaybackBoundRef.current = null;
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
  }, [isReady, resolvePlayheadSec, resolveSelectedPlaybackRange, wsRef]);

  useEffect(() => {
    const syncAfterChromeCommit = () => {
      queueMicrotask(() => {
        syncSelectedSegmentPlayingUi();
      });
    };
    return subscribeSelectionChrome(syncAfterChromeCommit);
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
    const anchor = pausedResumeAnchorRef.current;
    if (anchor && anchor.idx !== resolveEffectiveSelectedIdx()) {
      pausedResumeAnchorRef.current = null;
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

  const preserveLoopForNextSegmentSelect = useCallback(() => {
    preserveLoopOnNextSelectRef.current = true;
  }, []);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady || !segmentLoopPlayback) return;
    let replayScheduled = false;

    const maybeReplay = () => {
      if (replayScheduled || !segmentLoopPlaybackRef.current) return;
      const range = resolveSelectedPlaybackRange();
      if (!range) return;
      const t = resolvePlayheadSec();
      // 仅在当前时间位于语段范围内且接近末尾时才 replay，防止 seek 到语段外后误触发
      if (t < range.start || t + 0.04 < range.end) return;
      replayScheduled = true;
      requestAnimationFrame(() => {
        replayScheduled = false;
        if (!segmentLoopPlaybackRef.current) return;
        if (ws.isPlaying()) return;
        void playSelectedSegment();
      });
    };

    const unsubPause = ws.on("pause", maybeReplay);
    const unsubFinish = ws.on("finish", maybeReplay);
    return () => {
      unsubPause();
      unsubFinish();
    };
  }, [isReady, playSelectedSegment, resolvePlayheadSec, resolveSelectedPlaybackRange, segmentLoopPlayback, wsRef]);

  return {
    segmentLoopPlayback,
    isSelectedSegmentPlaying,
    preserveLoopForNextSegmentSelect,
    playSegmentAtIndex,
    runPlaySegmentResolved,
    toggleSelectedWaveformPlayImpl,
    clearSegmentPlaybackBound,
    clearPausedResumeAnchor,
    handleToggleSelectedWaveformLoop,
    handleToggleSelectedWaveformPlay,
  };
}
