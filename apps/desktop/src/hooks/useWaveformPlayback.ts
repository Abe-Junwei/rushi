import { useCallback } from "react";
import type WaveSurfer from "wavesurfer.js";
import { clientXToTimelinePx, clientXToTimeSecInTierScroll } from "../utils/waveformPointerTime";
import { timelinePxToTime } from "../utils/waveformProjection";
import { resolveLayoutDurationSec } from "../utils/waveformTimelineMetrics";

export function useWaveformPlayback(
  wsRef: React.MutableRefObject<WaveSurfer | null>,
  containerRef: React.MutableRefObject<HTMLDivElement | null>,
  isReady: boolean,
  layoutDurationSecRef: React.MutableRefObject<number>,
  layoutTimelineWidthPxRef: React.MutableRefObject<number>,
  applyGlobalPlaybackRateRef: React.MutableRefObject<() => void>,
  tierScrollRef?: React.RefObject<HTMLDivElement | null>,
) {
  const seek = useCallback(
    (timeSec: number) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      const d = resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current });
      if (d <= 0) {
        ws.setTime(Math.max(0, timeSec));
        return;
      }
      ws.setTime(Math.max(0, Math.min(timeSec, d)));
    },
    [isReady, layoutDurationSecRef, wsRef],
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
    const ws = wsRef.current;
    if (!ws || !isReady) return 0;
    return ws.getCurrentTime();
  }, [isReady, wsRef]);

  const seekByDelta = useCallback(
    (deltaSec: number) => {
      const ws = wsRef.current;
      if (!ws || !isReady) return;
      const d = resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current });
      const t =
        d > 0
          ? Math.max(0, Math.min(d, ws.getCurrentTime() + deltaSec))
          : Math.max(0, ws.getCurrentTime() + deltaSec);
      ws.setTime(t);
    },
    [isReady, layoutDurationSecRef, wsRef],
  );

  const clientXToTimeSec = useCallback(
    (clientX: number): number => {
      const dur = resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current });
      const tw = layoutTimelineWidthPxRef.current;
      if (tw <= 0 || dur <= 0) return 0;

      const tier = tierScrollRef?.current;
      if (tier) {
        const rect = tier.getBoundingClientRect();
        return clientXToTimeSecInTierScroll({
          clientX,
          tierViewportLeftPx: rect.left,
          tierScrollLeftPx: tier.scrollLeft,
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
    [isReady, wsRef, containerRef, layoutDurationSecRef, layoutTimelineWidthPxRef, tierScrollRef],
  );

  return {
    seek,
    togglePlay,
    getPlayheadTime,
    seekByDelta,
    clientXToTimeSec,
  };
}
