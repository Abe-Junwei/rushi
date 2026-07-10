import { useCallback } from "react";
import type WaveSurfer from "wavesurfer.js";
import { applyPeaksOrderedSeek } from "../services/waveform/transport";
import {
  clientXToTimelinePx,
  resolveWaveformPointerTimeSecFromClientX,
} from "../utils/waveformPointerTime";
import { timelinePxToTime } from "../utils/waveformProjection";
import { resolveLayoutDurationSec } from "../utils/waveformTimelineMetrics";
import type { TierViewportMetricsRef } from "./useProjectWaveformTypes";

export function useWaveformPlayback(
  wsRef: React.MutableRefObject<WaveSurfer | null>,
  containerRef: React.MutableRefObject<HTMLDivElement | null>,
  isReady: boolean,
  layoutDurationSecRef: React.MutableRefObject<number>,
  layoutTimelineWidthPxRef: React.MutableRefObject<number>,
  applyGlobalPlaybackRateRef: React.MutableRefObject<() => void>,
  tierScrollRef?: React.RefObject<HTMLDivElement | null>,
  tierViewportMetricsRef?: TierViewportMetricsRef,
  commitSeekUi?: (timeSec: number) => void,
  syncDisplayPlayheadAfterSeekRef?: React.MutableRefObject<((timeSec: number) => void) | null>,
  getDisplayPlayheadTimeSecRef?: React.MutableRefObject<(() => number) | null>,
) {
  const resolvePlayheadSec = useCallback(() => {
    const displayFn = getDisplayPlayheadTimeSecRef?.current;
    if (displayFn) return displayFn();
    return wsRef.current?.getCurrentTime() ?? 0;
  }, [getDisplayPlayheadTimeSecRef, wsRef]);

  const getRawMediaPlayheadTimeSec = useCallback((): number => {
    return wsRef.current?.getCurrentTime() ?? 0;
  }, [wsRef]);

  const getRawMediaIsPlaying = useCallback((): boolean => {
    return wsRef.current?.isPlaying() ?? false;
  }, [wsRef]);

  const seek = useCallback(
    (timeSec: number) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      const d = resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current });
      applyPeaksOrderedSeek({
        timeSec,
        durationSec: d,
        syncDisplayPlayheadAfterSeek: (t) => syncDisplayPlayheadAfterSeekRef?.current?.(t),
        setTime: (t) => ws.setTime(t),
        commitSeekUi,
      });
    },
    [
      commitSeekUi,
      isReady,
      layoutDurationSecRef,
      syncDisplayPlayheadAfterSeekRef,
      wsRef,
    ],
  );

  const togglePlay = useCallback(async () => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    if (ws.isPlaying()) ws.pause();
    else {
      applyGlobalPlaybackRateRef.current();
      await ws.play();
    }
  }, [applyGlobalPlaybackRateRef, isReady, wsRef]);

  const getPlayheadTime = useCallback((): number => {
    return resolvePlayheadSec();
  }, [resolvePlayheadSec]);

  const seekByDelta = useCallback(
    (deltaSec: number) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      const d = resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current });
      const base = resolvePlayheadSec();
      applyPeaksOrderedSeek({
        timeSec: base + deltaSec,
        durationSec: d,
        syncDisplayPlayheadAfterSeek: (t) => syncDisplayPlayheadAfterSeekRef?.current?.(t),
        setTime: (t) => ws.setTime(t),
        commitSeekUi,
      });
    },
    [
      commitSeekUi,
      isReady,
      layoutDurationSecRef,
      resolvePlayheadSec,
      syncDisplayPlayheadAfterSeekRef,
      wsRef,
    ],
  );

  const clientXToTimeSec = useCallback(
    (clientX: number): number => {
      const dur = resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current });
      const tw = layoutTimelineWidthPxRef.current;
      if (tw <= 0 || dur <= 0) return 0;

      const tier = tierScrollRef?.current;
      if (tier) {
        const tierMetrics = tierViewportMetricsRef?.current;
        return resolveWaveformPointerTimeSecFromClientX({
          clientX,
          tierScrollEl: tier,
          tierScrollLive: tierMetrics?.tierScrollLive,
          tierScrollLayout: tierMetrics?.tierScrollLayout,
          timelineWidthPx: tw,
          durationSec: dur,
        });
      }

      const el = containerRef.current;
      if (!wsRef.current || !el || !isReady) return 0;
      const rect = el.getBoundingClientRect();
      const relPx = clientXToTimelinePx(clientX, rect.left);
      return timelinePxToTime(relPx, tw, dur);
    },
    [
      isReady,
      wsRef,
      containerRef,
      layoutDurationSecRef,
      layoutTimelineWidthPxRef,
      tierScrollRef,
      tierViewportMetricsRef,
    ],
  );

  return {
    seek,
    togglePlay,
    getPlayheadTime,
    getRawMediaPlayheadTimeSec,
    getRawMediaIsPlaying,
    seekByDelta,
    clientXToTimeSec,
  };
}
