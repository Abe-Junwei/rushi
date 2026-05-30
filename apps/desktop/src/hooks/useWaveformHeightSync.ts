import { useLayoutEffect, type MutableRefObject, type RefObject } from "react";
import WaveSurfer from "wavesurfer.js";

interface UseWaveformHeightSyncArgs {
  wsRef: RefObject<WaveSurfer | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  waveformHeightPx: number;
  isReady: boolean;
  disabled?: boolean;
  appliedWaveformHeightRef: MutableRefObject<number>;
  pendingAppliedWaveformHeightRef: MutableRefObject<number | null>;
}

export function useWaveformHeightSync({
  wsRef,
  containerRef,
  waveformHeightPx,
  isReady,
  disabled,
  appliedWaveformHeightRef,
  pendingAppliedWaveformHeightRef,
}: UseWaveformHeightSyncArgs) {
  useLayoutEffect(() => {
    const el = containerRef.current;
    const h = waveformHeightPx;
    if (el) {
      el.style.backgroundColor = "transparent";
    }
    const ws = wsRef.current;
    if (!ws || !isReady || disabled) return;
    if (appliedWaveformHeightRef.current === h) {
      return;
    }
    pendingAppliedWaveformHeightRef.current = h;
    try {
      ws.setOptions({ height: h });
    } catch {
      pendingAppliedWaveformHeightRef.current = null;
    }
  }, [
    appliedWaveformHeightRef,
    containerRef,
    disabled,
    isReady,
    pendingAppliedWaveformHeightRef,
    waveformHeightPx,
    wsRef,
  ]);
}
