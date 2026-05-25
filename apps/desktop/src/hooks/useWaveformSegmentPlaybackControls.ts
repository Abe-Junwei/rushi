import { useCallback, useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import type RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentUidOf } from "../utils/segmentUid";
import { segmentRegionId } from "../utils/waveformRegionId";

const SEGMENT_PLAYBACK_RATE_KEY = "rushi.p1.segmentPlaybackRate";
const SEGMENT_PLAYBACK_RATE_MIN = 0.25;
const SEGMENT_PLAYBACK_RATE_MAX = 2;

function clampSegmentPlaybackRate(rate: number): number {
  return Math.min(SEGMENT_PLAYBACK_RATE_MAX, Math.max(SEGMENT_PLAYBACK_RATE_MIN, Math.round(rate * 100) / 100));
}

function readStoredSegmentPlaybackRate(): number {
  try {
    const raw = localStorage.getItem(SEGMENT_PLAYBACK_RATE_KEY);
    if (!raw) return 1;
    const value = Number(raw);
    return Number.isFinite(value) ? clampSegmentPlaybackRate(value) : 1;
  } catch {
    return 1;
  }
}

export function useWaveformSegmentPlaybackControls(args: {
  wsRef: React.MutableRefObject<WaveSurfer | null>;
  regionsRef: React.MutableRefObject<ReturnType<typeof RegionsPlugin.create> | null>;
  isReady: boolean;
  segments: SegmentDto[];
  selectedIdx: number;
}) {
  const { wsRef, regionsRef, isReady, segments, selectedIdx } = args;
  const [segmentPlaybackRate, setSegmentPlaybackRateState] = useState(readStoredSegmentPlaybackRate);
  const [segmentLoopPlayback, setSegmentLoopPlayback] = useState(false);
  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const selectedIdxRef = useRef(selectedIdx);
  selectedIdxRef.current = selectedIdx;
  const segmentPlaybackRateRef = useRef(segmentPlaybackRate);
  segmentPlaybackRateRef.current = segmentPlaybackRate;
  const segmentLoopPlaybackRef = useRef(segmentLoopPlayback);
  segmentLoopPlaybackRef.current = segmentLoopPlayback;

  const resolveSelectedPlaybackRange = useCallback(() => {
    const seg = segmentsRef.current[selectedIdxRef.current];
    if (!seg) return null;
    return {
      start: Math.min(seg.start_sec, seg.end_sec),
      end: Math.max(seg.start_sec, seg.end_sec),
    };
  }, []);

  const playSegmentAtIndex = useCallback(
    async (idx: number) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      const seg = segmentsRef.current[idx];
      if (!seg) return;
      const range = {
        start: Math.min(seg.start_sec, seg.end_sec),
        end: Math.max(seg.start_sec, seg.end_sec),
      };
      ws.setPlaybackRate(segmentPlaybackRateRef.current);
      const rp = regionsRef.current;
      const uid = segmentUidOf(seg);
      if (!uid) return;
      const regionId = segmentRegionId(uid);
      const selectedRegion = rp?.getRegions().find((region) => region.id === regionId);
      if (selectedRegion) {
        selectedRegion.play(true);
        return;
      }
      await ws.play(range.start, range.end);
    },
    [isReady, regionsRef, wsRef],
  );

  const playSelectedSegment = useCallback(async () => {
    const ws = wsRef.current;
    const range = resolveSelectedPlaybackRange();
    if (!ws || !isReady || !range) return;
    ws.setPlaybackRate(segmentPlaybackRateRef.current);
    await playSegmentAtIndex(selectedIdxRef.current);
  }, [isReady, playSegmentAtIndex, resolveSelectedPlaybackRange, wsRef]);

  const handleSegmentPlaybackRateChange = useCallback(
    (rate: number) => {
      const nextRate = clampSegmentPlaybackRate(rate);
      setSegmentPlaybackRateState(nextRate);
      try {
        localStorage.setItem(SEGMENT_PLAYBACK_RATE_KEY, String(nextRate));
      } catch {
        /* noop */
      }
      wsRef.current?.setPlaybackRate(nextRate);
    },
    [wsRef],
  );

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
    setSegmentLoopPlayback(false);
  }, [selectedIdx]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady || !segmentLoopPlayback) return;
    let replayScheduled = false;

    const maybeReplay = () => {
      if (replayScheduled || !segmentLoopPlaybackRef.current) return;
      const range = resolveSelectedPlaybackRange();
      if (!range) return;
      if (ws.getCurrentTime() + 0.04 < range.end) return;
      replayScheduled = true;
      requestAnimationFrame(() => {
        replayScheduled = false;
        if (!segmentLoopPlaybackRef.current) return;
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
    segmentPlaybackRate,
    segmentLoopPlayback,
    playSegmentAtIndex,
    handleSegmentPlaybackRateChange,
    handleToggleSelectedWaveformLoop,
    handleToggleSelectedWaveformPlay,
  };
}
