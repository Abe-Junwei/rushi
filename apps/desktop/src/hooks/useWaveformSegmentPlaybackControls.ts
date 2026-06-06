import { useCallback, useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { SegmentDto } from "../tauri/projectApi";

import { resolveSegmentPlaybackStartSec } from "../utils/formatMediaTime";

export type PlaySegmentAtIndexOptions = {
  /** Tab 听打：切段后自动循环当前语段。 */
  loop?: boolean;
};

export function useWaveformSegmentPlaybackControls(args: {
  wsRef: React.MutableRefObject<WaveSurfer | null>;
  isReady: boolean;
  segments: SegmentDto[];
  selectedIdx: number;
  getGlobalPlaybackRate: () => number;
}) {
  const { wsRef, isReady, segments, selectedIdx, getGlobalPlaybackRate } = args;
  const [segmentLoopPlayback, setSegmentLoopPlayback] = useState(false);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const selectedIdxRef = useRef(selectedIdx);
  selectedIdxRef.current = selectedIdx;
  const segmentLoopPlaybackRef = useRef(segmentLoopPlayback);
  segmentLoopPlaybackRef.current = segmentLoopPlayback;
  const preserveLoopOnNextSelectRef = useRef(false);

  const resolveSelectedPlaybackRange = useCallback(() => {
    const seg = segmentsRef.current[selectedIdxRef.current];
    if (!seg) return null;
    return {
      start: Math.min(seg.start_sec, seg.end_sec),
      end: Math.max(seg.start_sec, seg.end_sec),
    };
  }, []);

  const playGenerationRef = useRef(0);

  const applyGlobalPlaybackRate = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.setPlaybackRate(getGlobalPlaybackRate());
  }, [getGlobalPlaybackRate, wsRef]);

  const playSegmentAtIndex = useCallback(
    async (idx: number, options?: PlaySegmentAtIndexOptions) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      const seg = segmentsRef.current[idx];
      if (!seg) return;
      const gen = ++playGenerationRef.current;
      if (ws.isPlaying()) {
        ws.pause();
      }
      const range = {
        start: Math.min(seg.start_sec, seg.end_sec),
        end: Math.max(seg.start_sec, seg.end_sec),
      };
      const playFrom = resolveSegmentPlaybackStartSec(ws.getCurrentTime(), seg);
      applyGlobalPlaybackRate();
      if (options?.loop) {
        setSegmentLoopPlayback(true);
      }
      await ws.play(playFrom, range.end);
      if (gen !== playGenerationRef.current && ws.isPlaying()) {
        ws.pause();
      }
    },
    [applyGlobalPlaybackRate, isReady, wsRef],
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
    if (ws.isPlaying()) {
      ws.pause();
      return;
    }
    await playSelectedSegment();
  }, [isReady, playSelectedSegment, wsRef]);

  const handleToggleSelectedWaveformLoop = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    if (segmentLoopPlaybackRef.current) {
      setSegmentLoopPlayback(false);
      ws.pause();
      return;
    }
    const range = resolveSelectedPlaybackRange();
    if (!range) return;
    setSegmentLoopPlayback(true);
    await playSelectedSegment();
  }, [isReady, playSelectedSegment, resolveSelectedPlaybackRange, wsRef]);

  useEffect(() => {
    if (preserveLoopOnNextSelectRef.current) {
      preserveLoopOnNextSelectRef.current = false;
      return;
    }
    setSegmentLoopPlayback(false);
  }, [selectedIdx]);

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
      const t = ws.getCurrentTime();
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
  }, [isReady, playSelectedSegment, resolveSelectedPlaybackRange, segmentLoopPlayback, wsRef]);

  return {
    segmentLoopPlayback,
    preserveLoopForNextSegmentSelect,
    playSegmentAtIndex,
    handleToggleSelectedWaveformLoop,
    handleToggleSelectedWaveformPlay,
  };
}
