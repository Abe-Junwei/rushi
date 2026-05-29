/** LOD pixels-per-second tiers (aligned with Tauri `PEAK_LEVELS`). */
export const PEAK_LOD_LEVELS = [
  { level: 0, pixelsPerSecond: 2 },
  { level: 1, pixelsPerSecond: 20 },
  { level: 2, pixelsPerSecond: 200 },
] as const;

/**
 * 选择 px/s >= target 的最精细预计算级别，因为 waveform-data 的 resample
 * 只支持下采样（减小像素数），不允许上采样（增大像素数）。
 * 若 target 超过所有级别，回退到最精细级别（L2），由绘制层做视觉拉伸。
 */
export function pickPeakLodLevel(pxPerSec: number): number {
  let picked: number = PEAK_LOD_LEVELS[PEAK_LOD_LEVELS.length - 1].level;
  for (let i = PEAK_LOD_LEVELS.length - 1; i >= 0; i--) {
    const lod = PEAK_LOD_LEVELS[i];
    if (lod.pixelsPerSecond >= pxPerSec) {
      picked = lod.level;
    }
  }
  return picked;
}
