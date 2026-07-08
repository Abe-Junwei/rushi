import { useCallback, useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { SegmentDto } from "../tauri/projectApi";

import { resolveSegmentPlaybackStartSec } from "../utils/formatMediaTime";
import { imperativePlayheadSyncSuppressUntil } from "../utils/waveformImperativePlayheadSync";
import {
  armSegmentPlaybackSession,
  isActiveSegmentPlaybackBound,
  segmentPlaybackReachedEnd,
  type ActiveSegmentPlaybackBound,
} from "../utils/segmentPlaybackBound";

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
  syncDisplayPlayheadAfterSeekRef?: React.MutableRefObject<((timeSec: number) => void) | null>;
  imperativePlayheadSyncSuppressUntilRef?: React.MutableRefObject<number>;
}) {
  const {
    wsRef,
    isReady,
    segments,
    selectedIdx,
    getGlobalPlaybackRate,
    getPlayheadTime,
    syncDisplayPlayheadAfterSeekRef,
    imperativePlayheadSyncSuppressUntilRef,
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

  const resolveSelectedPlaybackRange = useCallback(() => {
    const seg = latestSegmentsRef.current[selectedIdxRef.current];
    if (!seg) return null;
    return {
      start: Math.min(seg.start_sec, seg.end_sec),
      end: Math.max(seg.start_sec, seg.end_sec),
    };
  }, []);

  const playGenerationRef = useRef(0);
  const segmentPlaybackBoundRef = useRef<ActiveSegmentPlaybackBound | null>(null);
  const segmentBoundStopInFlightRef = useRef(false);

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
      syncDisplayPlayheadAfterSeekRef?.current?.(timeSec);
      if (imperativePlayheadSyncSuppressUntilRef) {
        imperativePlayheadSyncSuppressUntilRef.current = imperativePlayheadSyncSuppressUntil(
          performance.now(),
        );
      }
      wsRef.current?.setTime(timeSec);
    },
    [imperativePlayheadSyncSuppressUntilRef, syncDisplayPlayheadAfterSeekRef, wsRef],
  );

  const playSegmentAtIndex = useCallback(
    async (idx: number, options?: PlaySegmentAtIndexOptions) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      const seg = latestSegmentsRef.current[idx];
      if (!seg) return;
      const gen = ++playGenerationRef.current;
      clearSegmentPlaybackBound();
      if (ws.isPlaying()) {
        ws.pause();
      }
      const range = {
        start: Math.min(seg.start_sec, seg.end_sec),
        end: Math.max(seg.start_sec, seg.end_sec),
      };
      const playFrom =
        options?.fromSec != null
          ? Math.max(range.start, Math.min(range.end, options.fromSec))
          : resolveSegmentPlaybackStartSec(resolvePlayheadSec(), seg);
      applyGlobalPlaybackRate();
      if (options?.loop) {
        setSegmentLoopPlayback(true);
      }
      atomicMediaSeek(playFrom);
      try {
        await ws.play();
      } catch {
        if (gen !== playGenerationRef.current) return;
        clearSegmentPlaybackBound();
        return;
      }
      if (gen !== playGenerationRef.current) {
        if (ws.isPlaying()) ws.pause();
        return;
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
    [applyGlobalPlaybackRate, atomicMediaSeek, clearSegmentPlaybackBound, isReady, resolvePlayheadSec, wsRef],
  );

  const playSelectedSegment = useCallback(async () => {
    const ws = wsRef.current;
    const range = resolveSelectedPlaybackRange();
    if (!ws || !isReady || !range) return;
    applyGlobalPlaybackRate();
    await playSegmentAtIndex(selectedIdxRef.current);
  }, [applyGlobalPlaybackRate, isReady, playSegmentAtIndex, resolveSelectedPlaybackRange, wsRef]);

  const handleToggleSelectedWaveformPlay = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    if (isSelectedSegmentPlayingRef.current) {
      clearSegmentPlaybackBound();
      if (ws.isPlaying()) ws.pause();
      return;
    }
    if (ws.isPlaying()) {
      ws.pause();
    }
    await playSelectedSegment();
  }, [clearSegmentPlaybackBound, isReady, playSelectedSegment, wsRef]);

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

    const unsubAudio = ws.on("audioprocess", enforceSegmentPlaybackBound);
    return () => {
      unsubAudio();
    };
  }, [atomicMediaSeek, isReady, resolvePlayheadSec, wsRef]);

  useEffect(() => {
    if (preserveLoopOnNextSelectRef.current) {
      preserveLoopOnNextSelectRef.current = false;
      return;
    }
    setSegmentLoopPlayback(false);
    clearSegmentPlaybackBound();
  }, [clearSegmentPlaybackBound, selectedIdx]);

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
    clearSegmentPlaybackBound,
    handleToggleSelectedWaveformLoop,
    handleToggleSelectedWaveformPlay,
  };
}
