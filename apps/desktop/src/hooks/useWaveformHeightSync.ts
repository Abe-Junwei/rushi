import { useLayoutEffect, type MutableRefObject, type RefObject } from "react";
import WaveSurfer from "wavesurfer.js";
import { COLORS } from "../config/tokens";
import { applyWaveSurferPeaksDrawMode } from "../services/waveform/waveSurferPeaksDraw";

interface UseWaveformHeightSyncArgs {
  wsRef: RefObject<WaveSurfer | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  waveformHeightPx: number;
  isReady: boolean;
  disabled?: boolean;
  appliedWaveformHeightRef: MutableRefObject<number>;
  pendingAppliedWaveformHeightRef: MutableRefObject<number | null>;
  appliedPeaksRef: MutableRefObject<boolean>;
}

export function useWaveformHeightSync({
  wsRef,
  containerRef,
  waveformHeightPx,
  isReady,
  disabled,
  appliedWaveformHeightRef,
  pendingAppliedWaveformHeightRef,
  appliedPeaksRef,
}: UseWaveformHeightSyncArgs) {
  useLayoutEffect(() => {
    const el = containerRef.current;
    const h = waveformHeightPx;
    if (el) {
      el.style.backgroundColor = COLORS.waveformSurface;
    }
    const ws = wsRef.current;
    if (!ws || !isReady || disabled) return;
    if (appliedWaveformHeightRef.current === h) {
      return;
    }
    pendingAppliedWaveformHeightRef.current = h;
    try {
      ws.setOptions({ height: h });
      // 总是同步当前 peaks 绘制模式，防止 WS 内部状态与 ref 不一致
      applyWaveSurferPeaksDrawMode(ws, appliedPeaksRef.current);
    } catch {
      try {
        ws.setOptions({
          height: h,
          ...(appliedPeaksRef.current
            ? { waveColor: "transparent", progressColor: "transparent" }
            : {
                waveColor: COLORS.waveformWave,
                progressColor: COLORS.waveformProgress,
              }),
          cursorColor: COLORS.waveformCursor,
        });
      } catch {
        pendingAppliedWaveformHeightRef.current = null;
      }
    }
  }, [
    appliedPeaksRef,
    appliedWaveformHeightRef,
    containerRef,
    disabled,
    isReady,
    pendingAppliedWaveformHeightRef,
    waveformHeightPx,
    wsRef,
  ]);
}
