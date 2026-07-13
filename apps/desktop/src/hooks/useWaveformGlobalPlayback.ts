import { useCallback, useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import {
  clampWaveformPlaybackRate,
  formatWaveformPlaybackRateLabel,
} from "../utils/waveformPlaybackRate";
import {
  migrateLegacySegmentPlaybackRateToGlobal,
  readStoredWaveformGlobalPlaybackRate,
  subscribeWaveformPrefs,
  writeStoredWaveformGlobalPlaybackRate,
} from "../utils/waveformPrefs";
import {
  resolveMediaPlaybackHost,
  type PlaybackTransport,
} from "../services/waveform/transport";

function readInitialGlobalPlaybackRate(): number {
  const migrated = migrateLegacySegmentPlaybackRateToGlobal();
  if (migrated != null) return migrated;
  return readStoredWaveformGlobalPlaybackRate();
}

export function useWaveformGlobalPlayback(
  wsRef: React.MutableRefObject<WaveSurfer | null>,
  isReady: boolean,
  transportRef?: React.MutableRefObject<PlaybackTransport | null>,
  requireTransport?: boolean,
) {
  const [globalPlaybackRate, setGlobalPlaybackRateState] = useState(readInitialGlobalPlaybackRate);
  const globalPlaybackRateRef = useRef(globalPlaybackRate);
  globalPlaybackRateRef.current = globalPlaybackRate;

  useEffect(() => {
    return subscribeWaveformPrefs(() => {
      const next = readStoredWaveformGlobalPlaybackRate();
      setGlobalPlaybackRateState(next);
      void Promise.resolve(
        resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
          requireTransport,
        })?.setPlaybackRate(next),
      );
    });
  }, [requireTransport, transportRef, wsRef]);

  useEffect(() => {
    const host = resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
      requireTransport,
    });
    if (!host || !isReady) return;
    void Promise.resolve(host.setPlaybackRate(globalPlaybackRateRef.current));
  }, [globalPlaybackRate, isReady, requireTransport, transportRef, wsRef]);

  const applyGlobalPlaybackRate = useCallback(() => {
    void Promise.resolve(
      resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
        requireTransport,
      })?.setPlaybackRate(globalPlaybackRateRef.current),
    );
  }, [requireTransport, transportRef, wsRef]);

  const setGlobalPlaybackRate = useCallback(
    (rate: number) => {
      const next = clampWaveformPlaybackRate(rate);
      setGlobalPlaybackRateState(next);
      writeStoredWaveformGlobalPlaybackRate(next);
      void Promise.resolve(
        resolveMediaPlaybackHost(wsRef.current, transportRef?.current, {
          requireTransport,
        })?.setPlaybackRate(next),
      );
    },
    [requireTransport, transportRef, wsRef],
  );

  return {
    globalPlaybackRate,
    globalPlaybackRateLabel: formatWaveformPlaybackRateLabel(globalPlaybackRate),
    setGlobalPlaybackRate,
    applyGlobalPlaybackRate,
  };
}
