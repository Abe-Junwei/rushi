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

  const clearSegmentPlaybackBound = useCallback(() => {
    segmentPlaybackBoundRef.current = null;
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
      if (playArgs.playFrom.kind === "seek") {
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

      segmentPlaybackBoundRef.current = {
        startSec: range.start,
        endSec: range.end,
        generation: gen,
        armed: false,
      };
      setIsSelectedSegmentPlaying(true);
    },
    [applyGlobalPlaybackRate, atomicMediaSeek, clearSegmentPlaybackBound, isReady, wsRef],
  );

  const playSegmentAtIndex = useCallback(
    async (idx: number, options?: PlaySegmentAtIndexOptions) => {
      const seg = latestSegmentsRef.current[idx];
      if (!seg) return;
      const playFrom = resolveSegmentPlayFrom({
        segment: seg,
        fromSec: options?.fromSec,
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
      clearSegmentPlaybackBound();
      ws.pause();
      const rawFreezeSec = getRawMediaPlayheadTimeSec?.();
      const freezeSec =
        typeof rawFreezeSec === "number" && Number.isFinite(rawFreezeSec)
          ? rawFreezeSec
          : resolvePlayheadSec();
      syncDisplayPlayheadAfterSeekRef?.current?.(freezeSec);
      return;
    }
    await playSelectedSegment();
  }, [
    clearSegmentPlaybackBound,
    getRawMediaPlayheadTimeSec,
    isReady,
    playSelectedSegment,
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
      clearSegmentPlaybackBound();
      ws.pause();
      return;
    }
    const range = resolveSelectedPlaybackRange();
    if (!range) return;
    setSegmentLoopPlayback(true);
    await playSelectedSegment();
  }, [clearSegmentPlaybackBound, isReady, playSelectedSegment, resolveSelectedPlaybackRange, wsRef]);

  /**
   * Keep overlay/toolbar play icon + segment end-bound in sync with live media
   * and the selected segment. Selecting while playing used to clear the bound and
   * leave the control stuck on "play".
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
    if (segmentPlaybackBoundRef.current) segmentPlaybackBoundRef.current = null;
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
      syncSelectedSegmentPlayingUi(timeSec);
    });
  }, [syncSelectedSegmentPlayingUi]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;

    const enforceSegmentPlaybackBound = () => {
      if (segmentBoundStopInFlightRef.current) return;
      const bound = segmentPlaybackBoundRef.current;
      if (!isActiveSegmentPlaybackBound(bound, playGenerationRef.current)) return;
      if (!ws.isPlaying()) return;
      const currentSec = resolvePlayheadSec();
      if (bound.armed && currentSec < bound.endSec - 0.1) return;
      if (!armSegmentPlaybackSession(bound, currentSec)) return;
      if (!segmentPlaybackReachedEnd(currentSec, bound.endSec)) return;

      segmentBoundStopInFlightRef.current = true;
      const startSec = bound.startSec;
      const endSec = bound.endSec;
      const loop = segmentLoopPlaybackRef.current;
      playGenerationRef.current += 1;

      queueMicrotask(() => {
        segmentBoundStopInFlightRef.current = false;
        if (!wsRef.current || wsRef.current !== ws) return;

        ws.pause();
        if (loop) {
          const clampedEnd = Math.min(endSec, ws.getDuration());
          if (Number.isFinite(clampedEnd)) {
            atomicMediaSeek(clampedEnd);
          }
        } else {
          segmentPlaybackBoundRef.current = null;
          setIsSelectedSegmentPlaying(false);
          const clampedStart = Math.max(0, Math.min(startSec, ws.getDuration()));
          if (Number.isFinite(clampedStart)) {
            atomicMediaSeek(clampedStart);
          }
        }
      });
    };

    const onAudio = () => {
      syncSelectedSegmentPlayingUi();
      enforceSegmentPlaybackBound();
    };
    const unsubAudio = ws.on("audioprocess", onAudio);
    return () => {
      unsubAudio();
    };
  }, [atomicMediaSeek, isReady, resolvePlayheadSec, syncSelectedSegmentPlayingUi, wsRef]);

  useEffect(() => {
    if (preserveLoopOnNextSelectRef.current) {
      preserveLoopOnNextSelectRef.current = false;
      return;
    }
    setSegmentLoopPlayback(false);
    // Do not blindly clear playing UI while media is still playing — sync against
    // the new selection (re-arms bound when playhead is already inside / after seek).
    syncSelectedSegmentPlayingUi();
  }, [selectedIdx, syncSelectedSegmentPlayingUi]);

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
    handleToggleSelectedWaveformLoop,
    handleToggleSelectedWaveformPlay,
  };
}
