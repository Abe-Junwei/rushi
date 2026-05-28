import type WaveSurfer from "wavesurfer.js";
import { COLORS } from "../../config/tokens";

export const WAVEFORM_WS_TRANSPARENT_DRAW = {
  waveColor: "transparent",
  progressColor: "transparent",
} as const;

export const WAVEFORM_WS_OPAQUE_DRAW = {
  waveColor: COLORS.waveformWave,
  progressColor: COLORS.waveformProgress,
} as const;

/** peaks 由 Canvas 绘制时，WS 仅保留播放/seek，波形层透明。 */
export function applyWaveSurferPeaksDrawMode(ws: WaveSurfer, canvasPeaksActive: boolean): void {
  try {
    ws.setOptions(canvasPeaksActive ? WAVEFORM_WS_TRANSPARENT_DRAW : WAVEFORM_WS_OPAQUE_DRAW);
  } catch {
    /* noop */
  }
}
