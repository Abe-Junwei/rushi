import { useCallback } from "react";
import type WaveSurfer from "wavesurfer.js";
import {
  applyPeaksOrderedSeek,
  resolveMediaPlaybackHost,
  type PlaybackTransport,
} from "../services/waveform/transport";
import { logDesktopUi } from "../services/desktopUiLog";
import { runGatedMediaPause, runGatedMediaPlay } from "../utils/mediaPlayGate";
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
  transportRef?: React.MutableRefObject<PlaybackTransport | null>,
  requireTransport?: boolean,
) {
  const resolvePlayheadSec = useCallback(() => {
    const displayFn = getDisplayPlayheadTimeSecRef?.current;
    if (displayFn) return displayFn();
    const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
      requireTransport,
    });
    return host?.getCurrentTime() ?? 0;
  }, [getDisplayPlayheadTimeSecRef, requireTransport, transportRef, wsRef]);

  const getRawMediaPlayheadTimeSec = useCallback((): number => {
    const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
      requireTransport,
    });
    return host?.getCurrentTime() ?? 0;
  }, [requireTransport, transportRef, wsRef]);

  const getRawMediaIsPlaying = useCallback((): boolean => {
    const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
      requireTransport,
    });
    return host?.isPlaying() ?? false;
  }, [requireTransport, transportRef, wsRef]);

  const seek = useCallback(
    (timeSec: number) => {
      const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
        requireTransport,
      });
      if (!host || !isReady) return;
      const d = resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current });
      applyPeaksOrderedSeek({
        timeSec,
        durationSec: d,
        syncDisplayPlayheadAfterSeek: (t) => syncDisplayPlayheadAfterSeekRef?.current?.(t),
        setTime: (t) => host.setTime(t),
        commitSeekUi,
      });
    },
    [
      commitSeekUi,
      isReady,
      layoutDurationSecRef,
      requireTransport,
      syncDisplayPlayheadAfterSeekRef,
      transportRef,
      wsRef,
    ],
  );

  const togglePlay = useCallback(async () => {
    const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
      requireTransport,
    });
    if (!isReady) {
      logDesktopUi("WARN", "[s4] play ignored: waveform not ready");
      return;
    }
    if (!host) {
      logDesktopUi(
        "WARN",
        requireTransport
          ? "[s4] play ignored: native transport not ready"
          : "[s4] play ignored: no media host",
      );
      return;
    }
    if (host.isPlaying()) {
      try {
        await runGatedMediaPause(host.gateHost, () => host.pause());
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logDesktopUi("ERROR", `[s4] pause failed: ${msg}`);
      }
      return;
    }
    // Gate play(): concurrent Space/button can nest HTMLMediaElement.play and
    // deadlock WebKit MediaSession sync IPC on the WebContent main thread.
    try {
      const result = await runGatedMediaPlay(host.gateHost, () => {
        applyGlobalPlaybackRateRef.current();
        return host.play();
      });
      if (result === "busy") {
        logDesktopUi("WARN", "[s4] play ignored: media gate busy");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDesktopUi("ERROR", `[s4] play failed: ${msg}`);
    }
  }, [applyGlobalPlaybackRateRef, isReady, requireTransport, transportRef, wsRef]);

  const getPlayheadTime = useCallback((): number => {
    return resolvePlayheadSec();
  }, [resolvePlayheadSec]);

  const seekByDelta = useCallback(
    (deltaSec: number) => {
      const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
        requireTransport,
      });
      if (!host || !isReady) return;
      const d = resolveLayoutDurationSec({ layoutDurationSecRef: layoutDurationSecRef.current });
      const base = resolvePlayheadSec();
      applyPeaksOrderedSeek({
        timeSec: base + deltaSec,
        durationSec: d,
        syncDisplayPlayheadAfterSeek: (t) => syncDisplayPlayheadAfterSeekRef?.current?.(t),
        setTime: (t) => host.setTime(t),
        commitSeekUi,
      });
    },
    [
      commitSeekUi,
      isReady,
      layoutDurationSecRef,
      requireTransport,
      resolvePlayheadSec,
      syncDisplayPlayheadAfterSeekRef,
      transportRef,
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
