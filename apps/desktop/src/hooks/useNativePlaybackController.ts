import { useEffect, type MutableRefObject } from "react";
import {
  createNativeAudioPlaybackTransport,
  type PlaybackTransport,
} from "../services/waveform/transport";
import { resolveLayoutDurationSec } from "../utils/waveformTimelineMetrics";
import { logDesktopUi } from "../services/desktopUiLog";
import type { PeakCache } from "../services/waveform/PeakCache";

/**
 * Owns native {@link PlaybackTransport} lifecycle independent of WaveSurfer visual mount.
 * Duration comes from engine Ready events (hint from layout/peaks is optional).
 * Distinguishes audioReady (transport loaded) from visualReady (WaveSurfer peaks).
 */
export function useNativePlaybackController(args: {
  enabled: boolean;
  mediaDiskPath: string | null | undefined;
  layoutDurationSecRef: MutableRefObject<number>;
  peakCacheRef: MutableRefObject<PeakCache | null>;
  transportRef: MutableRefObject<PlaybackTransport | null>;
  applyGlobalPlaybackRate: () => void;
  onWsAudioprocessRef?: MutableRefObject<((timeSec: number) => void) | null>;
  lastTimeUiCommitRef: MutableRefObject<number>;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (timeSec: number) => void;
  setLoadError: (message: string | null) => void;
  /** Optional: mirror audioReady for toolbar disable / UX. */
  setAudioReady?: (ready: boolean) => void;
  /** Bump after transport assigned or cleared so subscribers re-bind. */
  onTransportEpoch?: () => void;
}): void {
  const {
    enabled,
    mediaDiskPath,
    layoutDurationSecRef,
    peakCacheRef,
    transportRef,
    applyGlobalPlaybackRate,
    onWsAudioprocessRef,
    lastTimeUiCommitRef,
    setIsPlaying,
    setCurrentTime,
    setLoadError,
    setAudioReady,
    onTransportEpoch,
  } = args;

  useEffect(() => {
    if (!enabled || !mediaDiskPath) {
      setAudioReady?.(false);
      return;
    }

    // Hint only — engine Ready / probe is the duration authority.
    const durationHintSec = resolveLayoutDurationSec({
      layoutDurationSecRef: layoutDurationSecRef.current,
      peakCacheDurationSec: peakCacheRef.current?.durationSec ?? 0,
    });

    let cancelled = false;
    setAudioReady?.(false);
    const transport = createNativeAudioPlaybackTransport();
    const unsub = transport.subscribe({
      onPlay: () => {
        if (!cancelled) setIsPlaying(true);
      },
      onPause: () => {
        if (!cancelled) setIsPlaying(false);
      },
      onFinish: () => {
        if (!cancelled) setIsPlaying(false);
      },
      onReady: (durationSec) => {
        if (cancelled) return;
        if (durationSec > 0 && layoutDurationSecRef.current <= 0) {
          layoutDurationSecRef.current = durationSec;
        }
      },
      onTimeUpdate: (timeSec) => {
        if (cancelled) return;
        lastTimeUiCommitRef.current = timeSec;
        if (transport.isPlaying()) {
          onWsAudioprocessRef?.current?.(timeSec);
        } else {
          setCurrentTime(timeSec);
        }
      },
      onDeviceChanged: (message) => {
        if (cancelled) return;
        logDesktopUi("WARN", `[s4] audio device changed: ${message}`);
      },
      onUnderrun: (consecutive) => {
        if (cancelled) return;
        logDesktopUi("WARN", `[s4] audio underrun consecutive=${consecutive}`);
      },
      onError: (message) => {
        if (cancelled) return;
        logDesktopUi("ERROR", `native audio: ${message}`);
        setLoadError(message);
      },
    });

    void transport
      .load({ mediaDiskPath, durationSec: Math.max(0, durationHintSec) })
      .then(() => {
        if (cancelled) return;
        transportRef.current = transport;
        applyGlobalPlaybackRate();
        setAudioReady?.(true);
        onTransportEpoch?.();
        logDesktopUi("INFO", "[s4] native audio loaded");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        logDesktopUi("ERROR", `native audio load failed: ${msg}`);
        setAudioReady?.(false);
        setLoadError(msg || "原生音频引擎加载失败");
      });

    return () => {
      cancelled = true;
      unsub();
      const wasAssigned = transportRef.current === transport;
      if (wasAssigned) {
        transportRef.current = null;
      }
      setAudioReady?.(false);
      void transport.dispose();
      if (wasAssigned) {
        onTransportEpoch?.();
      }
    };
  }, [
    applyGlobalPlaybackRate,
    enabled,
    lastTimeUiCommitRef,
    layoutDurationSecRef,
    mediaDiskPath,
    onTransportEpoch,
    onWsAudioprocessRef,
    peakCacheRef,
    setAudioReady,
    setCurrentTime,
    setIsPlaying,
    setLoadError,
    transportRef,
  ]);
}
