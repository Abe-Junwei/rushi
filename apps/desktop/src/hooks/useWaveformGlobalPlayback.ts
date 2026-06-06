import { useCallback, useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import {
  clampWaveformPlaybackRate,
  formatWaveformPlaybackRateLabel,
} from "../utils/waveformPlaybackRate";
import {
  migrateLegacySegmentPlaybackRateToGlobal,
  readStoredWaveformGlobalPlaybackRate,
  writeStoredWaveformGlobalPlaybackRate,
} from "../utils/waveformPrefs";

function readInitialGlobalPlaybackRate(): number {
  const migrated = migrateLegacySegmentPlaybackRateToGlobal();
  if (migrated != null) return migrated;
  return readStoredWaveformGlobalPlaybackRate();
}

export function useWaveformGlobalPlayback(
  wsRef: React.MutableRefObject<WaveSurfer | null>,
  isReady: boolean,
) {
  const [globalPlaybackRate, setGlobalPlaybackRateState] = useState(readInitialGlobalPlaybackRate);
  const globalPlaybackRateRef = useRef(globalPlaybackRate);
  globalPlaybackRateRef.current = globalPlaybackRate;

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady) return;
    ws.setPlaybackRate(globalPlaybackRateRef.current);
  }, [globalPlaybackRate, isReady, wsRef]);

  const applyGlobalPlaybackRate = useCallback(() => {
    wsRef.current?.setPlaybackRate(globalPlaybackRateRef.current);
  }, [wsRef]);

  const setGlobalPlaybackRate = useCallback(
    (rate: number) => {
      const next = clampWaveformPlaybackRate(rate);
      setGlobalPlaybackRateState(next);
      writeStoredWaveformGlobalPlaybackRate(next);
      wsRef.current?.setPlaybackRate(next);
    },
    [wsRef],
  );

  return {
    globalPlaybackRate,
    globalPlaybackRateLabel: formatWaveformPlaybackRateLabel(globalPlaybackRate),
    setGlobalPlaybackRate,
    applyGlobalPlaybackRate,
  };
}
