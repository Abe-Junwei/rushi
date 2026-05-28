/** LOD pixels-per-second tiers (aligned with Tauri `PEAK_LEVELS`). */
export const PEAK_LOD_LEVELS = [
  { level: 0, pixelsPerSecond: 2 },
  { level: 1, pixelsPerSecond: 20 },
  { level: 2, pixelsPerSecond: 200 },
] as const;

/** Pick the finest precomputed level that still covers the target px/s without upsampling beyond 2×. */
export function pickPeakLodLevel(pxPerSec: number): number {
  let picked: number = PEAK_LOD_LEVELS[0]!.level;
  for (const lod of PEAK_LOD_LEVELS) {
    if (lod.pixelsPerSecond <= pxPerSec * 2) {
      picked = lod.level;
    }
  }
  return picked;
}
