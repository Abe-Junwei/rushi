import { useLayoutEffect, type MutableRefObject, type RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";

export function useWaveformZoomSync(args: {
  wsRef: RefObject<WaveSurfer | null>;
  isReady: boolean;
  disabled?: boolean;
  minPxPerSec: number;
  appliedZoomPxPerSecRef: MutableRefObject<number>;
}) {
  const { wsRef, isReady, disabled, minPxPerSec, appliedZoomPxPerSecRef } = args;

  // 同步 zoom：避免 useEffect + RAF 额外晚一帧，缩放提交后立刻 redraw。
  useLayoutEffect(() => {
    const ws = wsRef.current;
    if (!ws || !isReady || disabled) return;
    if (appliedZoomPxPerSecRef.current === minPxPerSec) return;
    try {
      ws.zoom(minPxPerSec);
      appliedZoomPxPerSecRef.current = minPxPerSec;
    } catch {
      /* noop */
    }
  }, [appliedZoomPxPerSecRef, disabled, isReady, minPxPerSec, wsRef]);
}
