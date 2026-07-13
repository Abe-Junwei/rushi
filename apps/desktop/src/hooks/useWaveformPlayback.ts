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

  const getDisplayMediaPlayheadTimeSec = useCallback((): number => {
    const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
      requireTransport,
    });
    return host?.getDisplayTime() ?? 0;
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
      void applyPeaksOrderedSeek({
        timeSec,
        durationSec: d,
        syncDisplayPlayheadAfterSeek: (t) => syncDisplayPlayheadAfterSeekRef?.current?.(t),
        setTime: (t) => {
          return host.setTime(t);
        },
        commitSeekUi,
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        logDesktopUi("ERROR", `[s4] seek failed: ${msg}`);
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
      logDesktopUi("WARN", "[s4] play ignored: waveform visual not ready");
      return;
    }
    if (!host) {
      logDesktopUi(
        "WARN",
        requireTransport
          ? "[s4] audio engine loading — play ignored until native transport ready"
          : "[s4] play ignored: no media host",
      );
      return;
    }
    const gateOpts = host.isNative ? { pauseToPlayGapMs: 0 } : undefined;
    if (host.isPlaying()) {
      try {
        await runGatedMediaPause(host.gateHost, () => host.pause(), gateOpts);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logDesktopUi("ERROR", `[s4] pause failed: ${msg}`);
      }
      return;
    }
    // Gate play(): concurrent Space/button can nest HTMLMediaElement.play and
    // deadlock WebKit MediaSession sync IPC on the WebContent main thread.
    // Native CPAL uses gap=0 (serial queue only).
    try {
      const result = await runGatedMediaPlay(
        host.gateHost,
        () => {
          applyGlobalPlaybackRateRef.current();
          return host.play();
        },
        gateOpts,
      );
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
      void applyPeaksOrderedSeek({
        timeSec: base + deltaSec,
        durationSec: d,
        syncDisplayPlayheadAfterSeek: (t) => syncDisplayPlayheadAfterSeekRef?.current?.(t),
        setTime: (t) => {
          return host.setTime(t);
        },
        commitSeekUi,
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        logDesktopUi("ERROR", `[s4] seek failed: ${msg}`);
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
    getDisplayMediaPlayheadTimeSec,
    getRawMediaIsPlaying,
    seekByDelta,
    clientXToTimeSec,
  };
}
