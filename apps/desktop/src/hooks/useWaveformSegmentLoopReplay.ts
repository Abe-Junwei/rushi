import { useEffect, type MutableRefObject } from "react";
import type WaveSurfer from "wavesurfer.js";

/** When segment loop is on, replay selected segment after pause/finish near end. */
export function useWaveformSegmentLoopReplay(args: {
  wsRef: MutableRefObject<WaveSurfer | null>;
  isReady: boolean;
  segmentLoopPlayback: boolean;
  segmentLoopPlaybackRef: MutableRefObject<boolean>;
  resolvePlayheadSec: () => number;
  resolveSelectedPlaybackRange: () => { start: number; end: number } | null;
  playSelectedSegment: () => Promise<void>;
}): void {
  const {
    wsRef,
    isReady,
    segmentLoopPlayback,
    segmentLoopPlaybackRef,
    resolvePlayheadSec,
    resolveSelectedPlaybackRange,
    playSelectedSegment,
  } = args;

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
  }, [
    isReady,
    playSelectedSegment,
    resolvePlayheadSec,
    resolveSelectedPlaybackRange,
    segmentLoopPlayback,
    segmentLoopPlaybackRef,
    wsRef,
  ]);
}
